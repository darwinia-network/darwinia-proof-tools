import * as path from "path";
import Web3 from "web3";
import { config } from "../cfg";
import { storePath, log, Logger, parseHeader } from "../lib/utils";

// init sqlite3 to save txs
// eslint-disable-next-line @typescript-eslint/no-var-requires
const knex = require("knex")({
    client: "sqlite3",
    connection: {
        filename: storePath(path.join(config.root, "relay_blocks.db")),
    },
    useNullAsDefault: true
});

// check if table exists
async function checkTable(start: number) {
    const exists = await knex.schema.hasTable("blocks");
    if (!exists) {
        knex.schema.createTable("blocks", (table: any) => {
            table.integer("height").unique();
            table.string("block").unique();
        }).catch((e: any) => log(e, Logger.Error));
    } else {
        // delete used blocks
        await knex("blocks")
            .where("height", "<", start)
            .del();
    }
}

async function restart(number: number) {
    log("reached the lastest block, sleep for 10 seconds", Logger.Warn);
    setTimeout(async () => {
        // eslint-disable-next-line @typescript-eslint/no-use-before-define
        await fetch.call(this, number, true);
    }, 10000);
}

// get ethereum headers, restart when
//
// - has fetched
// - got null block
// - reach the lastest block
export default async function fetch(number: number, loop: boolean) {
    const exists = await knex("blocks").whereExists(function() {
        this.select("*").from("blocks").whereRaw(`blocks.height = ${number}`);
    });

    if (exists.length > 0) {
        log("header exists, move to next...");
        await fetch.call(this, number + 1, true);
        return;
    }

    try {
        let block = await this.eth.getBlock(number);

        if (block != null) {
            block = parseHeader(block);
            log(`got block ${block.hash}`);
            log(`\t${JSON.stringify(block)}`);
            await knex("blocks").insert({
                height: number,
                block: JSON.stringify(block)
            });

            if (loop) {
                await fetch.call(this, number + 1, true);
            }
        } else {
            await restart.call(this, number);
        }
    } catch (e) {
        console.error(e);
        await restart.call(this, number);
    }
}

// loop block and tx to sqlite
async function loop(start: number) {
    log(`start fetching eth headers from ${start}...`);
    const web3 = new Web3(new Web3.providers.HttpProvider(config.web3));
    await checkTable(start);

    fetch.call(web3, start, true).catch(() => {
        log("eth header fetcher got broken", Logger.Error);
    });
}

// main
(function() {
    const args = process.argv;
    if (args.length < 3) {
        log([
            "wrong args, please pass the start block number, ",
            "FOR EXAMPLE: ts-node fetcher.ts 767676",
        ].join(""), Logger.Error);
    }

    loop(parseInt(args[args.length - 1]));
}());
