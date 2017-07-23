# Introduction 
This tool extracts documents from a MongoDB collection and inserts all or parts of them into a MSSQL DB. 

The admin can choose which fields to insert by defining a schema. The types in the schema are used for automatic conversion.

# Getting Started

1.  Install nodejs
1.	Clone or download the repo
2.	Install dependencies with `npm install`
3.  Modify `src/config.json` to your liking (see below)
4.	Build with `npm run build`
5.	Run with `npm start`

## Configuration

```JavaScript
{
    "mssql": {
        "connection": {
            "server": "your server name",
            "user": "your user name",
            "password": "your password",
            "database": "your db name",
            "options": {
                "encrypt": true
            }
        },
        "table": "your sql table name"
    },
    "mongo": {
        "connectionString": "your mongodb connection string",
        "collection": "your collection name",
        "query": { }
    },
    "schema": {
        "sqlcolumn1": { "source": "mongofield1", "type": "string" },
        "sqlcolumn2": { "source": "deep.mongofield2", "type": "datetime" },
        "sqlcolumn3": { "source": "very.deep.mongofield3", "type": "number" }
    },
    "frequency": number of ms to wait before starting next ETL
}
```

| Type     | Description                                      | Conversion                                                  |
|----------|--------------------------------------------------|-------------------------------------------------------------|
| string   | Regular Strings, used also for nchar and varchar | Will try to convert to string, otherwise empty string       |
| number   | All numbers                                      | Will try to convert to number, otherwise 0                  |
| datetime | Date field in SQL                                | If source is date, will convert to datetime, otherwise null |
| bit      | Bit (0/1) field in SQL, similar to boolean       | If source exists or is true, then 1, otherwise 0            |
