/**
 * MongoDB to MSSQL ETL Tool
 * (c) Cognigy GmbH - www.cognigy.com
 *
 * Loads documents from a MongoDB and extracts fields defined in a schema
 * to insert into MSSQL database
 */

import { MongoClient } from 'mongodb';
import * as deep from 'deep-access';
import * as chalk from 'chalk';
import * as fs from 'fs';
const mssql = require('mssql');

const options = require('./config.json');

/**
 * Creates the initial fields array
 */
let makeFields = () => {
	let ret = [];
	for (let field in options.schema) {
		if (options.schema.hasOwnProperty(field))
			ret.push(field);
	}
	return ret;
};

const fields = makeFields();

/**
 * Takes a MongoDB document and parses it into the correct format for the SQL DB
 * @param doc MongoDB Document
 */
let parseDoc = (doc: any): string => {
	let values = [];
	for (let field in options.schema) {
		if (options.schema.hasOwnProperty(field)) {
			let value = undefined;

			try {
				value = deep(doc, options.schema[field].source);
			} catch (err) {
				value = undefined;
			}

			switch (options.schema[field].type) {
				case "string":
					if (typeof value === 'string') value = value.replace(/'/g, "''");
					else if (typeof value === 'object') value = JSON.stringify(value).replace(/'/g, "''");
					else if (typeof value === 'number') value = value.toString();
					else if (typeof value === 'boolean') value = (value) ? "1" : "0";
					else value = "";
					value = "'" + value + "'";
					break;
				case "number":
					if (typeof value === 'number') value = value;
					else if (typeof value === 'boolean') value = (value) ? 1 : 0;
					else if (typeof value === 'string') value = Number(value);
					else value = 0;
					if (value === 'NaN') value = 0;
					break;
				case "datetime":
					if (value instanceof Date) {
						value = value.getFullYear() + "-" + (value.getMonth() + 1) + "-" + value.getDate() + " " + value.getHours() + ":" + value.getMinutes() + ":" + value.getSeconds() + "." + value.getMilliseconds();
					} else value = "";
					value = "'" + value + "'";
					break;
				case "bit":
					value = (value) ? 1 : 0;
					break;
			}
			values.push(value);
		}
	}
	let insert = "INSERT INTO " + options.mssql.table + " (" + fields.join(", ") + ") VALUES (" + values.join(", ") + ")";
	return insert;
};

/**
 * Runs the ETL operation
 */
let runETL = async (date: Date): Promise<void> => {
	let errorlog = "";
	let curDate = new Date();
	try {
		// Initialise MongoDB and SQL connections
		let mongoDB = await MongoClient.connect(options.mongo.connectionString);
		process.stdout.write("\n\n\n## " + chalk.green("MongoDB Connected"));
		let sql = await mssql.connect(options.mssql.connection);
		process.stdout.write("\n## " + chalk.green("SQL Connected"));

		// Find MongoDB documents
		let query = options.mongo.query;
		if (date) options.mongo.query.timestamp = {"$gte": date};

		let mongoCollection = mongoDB.collection(options.mongo.collection);
		process.stdout.write("\n## " + chalk.green("Loading documents from Mongo for query " + JSON.stringify(query)));
		
		// save timestamp for next cutoff
		curDate = new Date();

		let mongoResult = await mongoCollection.find(query).toArray();
		let mongoCount = await mongoResult.length;

		process.stdout.write("\n## " + chalk.green("Found " + chalk.yellow(mongoCount.toString()) + " MongoDB document(s) to extract"));
		process.stdout.write("\n## " + chalk.green("Starting SQL Transaction..."));

		let x = 0; // document counter
		let t1 = new Date().getTime();
		const transaction = new mssql.Transaction(sql);
		await transaction.begin();
		let r = await new mssql.Request(transaction);
		if (!date) {
			await r.query("DELETE FROM " + options.mssql.table + " WHERE 1=1");
			process.stdout.write("\n## " + chalk.green("Table '" + options.mssql.table + "' purged"));
		}
		
		process.stdout.write("\n## " + chalk.yellow(x.toString()) + chalk.green(" records written"));

		// loop through all MongoDB documents and parse them into the correct format for inserting into SQL
		for (let doc of mongoResult) {
			let query = "";
			try {
				let r = await new mssql.Request(transaction);
				query = parseDoc(doc);
				let result = await r.query(query);
				x++;
				process.stdout.write("\r\x1b[K");
				process.stdout.write("## " + chalk.yellow(x.toString()) + chalk.green(" records written"));
			} catch (err) {
				errorlog = errorlog + "\n" + err;
				console.log("ERROR: ", query);
			}
		}
		await transaction.commit();
		let t2 = new Date().getTime();
		process.stdout.write("\r\x1b[K");
		process.stdout.write("## " + chalk.yellow(x.toString()) + chalk.green(" record(s) written in " + chalk.yellow((t2 - t1).toString()) + " ms"));
		process.stdout.write("\n## " + chalk.green("Finished SQL Transaction"));
		mssql.close();
		process.stdout.write("\n## " + chalk.green("SQL Connection closed"));
	} catch (err) {
		console.error("\n" + chalk.red("ERROR:", err));
	}

	// run on schedule if frequency is set
	if (options.frequency > 0) {
		// if there were errors, write them to the error log
		if (errorlog !== "") {
			fs.writeFile(__dirname + '/error.log', errorlog, (err) => {
				if (err) console.log(err);
				else process.stdout.write("\n## " + chalk.red("Errors printed to error.log"));
			});
		}
		process.stdout.write("\n## " + chalk.green("Awaiting next execution in " + chalk.yellow(options.frequency.toString()) + " ms"));
		setTimeout(() => {
			// run subsequent ETL with date set for incremental update
			runETL(curDate);
		}, options.frequency);
	} else {
		process.stdout.write("\n## " + chalk.green("Shutting down\n"));
		// if there were errors, write them to the error log
		if (errorlog !== "") {
			fs.writeFile(__dirname + '/error.log', errorlog, (err) => {
				if (err) console.log(err);
				else process.stdout.write("\n## " + chalk.red("Errors printed to error.log\n"));
				process.exit();
			});
		} else process.exit();
	}

	return Promise.resolve();
};

// run initial ETL, no date set
runETL(null);


