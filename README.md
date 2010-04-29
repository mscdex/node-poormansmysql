# node-poormansmysql

node-poormansmysql is a MySQL driver for [node.js](http://nodejs.org/) that executes queries using the mysql command-line client.


# Requirements

* [node.js](http://nodejs.org/) -- tested with [0.1.92](http://github.com/ry/node/commit/caa828a242f39b6158084ef4376355161c14fe34)
* [libxmljs](http://github.com/polotek/libxmljs) -- tested with [7903666cd29001b19fb0](http://github.com/polotek/libxmljs/commit/7903666cd29001b19fb0821f62bcf50f6b5576b3)


# Documentation

MysqlConnection Methods:

* (constructor) **MysqlConnection**(_config_)
  * **Description**: Performs initialization and sets the connection configuration. All properties supplied in _config_ overwrite the defaults listed below.
  * **Parameters**:
     * _config_: (Object) An object containing the necessary connection information to connect to the MySQL server and perform queries. At least the user and password should be supplied. The default configuration is:

                user: null,
                password: null,
                db: null,
                host: 'localhost',
                port: 3306,
                connect_timeout: 0, // in seconds
                query_timeout: 0 // in seconds (TODO)
  * **Return Value**: (MysqlConnection) An instance of MysqlConnection.
* **setConfig**(_config_)
  * **Description**: Sets the connection configuration. This is only needed if you are reusing the instance and need to change the connection information. As with the constructor, all properties supplied in _config_ are merged with the defaults.
  * **Parameters**: 
     * _config_: (Object) An object containing the necessary connection information to connect to the MySQL server and perform queries. At least the user and password should be supplied. See above for the default configuration.
  * **Return Value**: None
* **query**(_sql_)
  * **Description**: Enqueues an SQL statement.
  * **Parameters**:
     * _sql_: (String) A valid SQL statement. Do not include a trailing semicolon at the end of the statement.
  * **Return Value**: None
* **execute**()
  * **Description**: Begins executing the enqueued SQL statements all at once.
  * **Parameters**: None
  * **Return Value**: (Boolean) _true_ if there were statements to be executed and the 'user' and 'password' connection details have been supplied, _false_ otherwise.
* (getter) **affectedRows**
  * **Description**: Returns the number of rows updated, inserted, or deleted by the last SQL statement.
  * **Return Value**: (Integer) The number of rows affected by the last SQL statement.
* (getter) **lastInsertId**
  * **Description**: Returns the first automatically generated value that was set for an AUTO_INCREMENT column by the most recent INSERT statement. See [here](http://dev.mysql.com/doc/refman/5.0/en/information-functions.html#function_last-insert-id) for more details.
  * **Return Value**: (Integer) The value of the AUTO_INCREMENT column for the last INSERTed row.

MysqlConnection Events:

* **error**
  * **Description**: Fired when an error occurs. This can be either a MySQL error or a child process spawning error.
  * **Parameters**:
     * _err_: (String) The error details.
* **row**
  * **Description**: Fired when a row has been generated for the given query.
  * **Parameters**:
     * _rowdata_: (Object) A hash containing a single row from the results of a query.
	 * _sql_: (String) The original SQL (SELECT) statement that generated the row.
* **queryDone**
  * **Description**: Fired when the given query has completed and any/all resulting rows for the given query have been emitted.
  * **Parameters**:
	 * _sql_: (String) The original SQL (SELECT) statement that generated the row.
* **done**
  * **Description**: Fired when <u>**all**</u> queries have completed and any/all resulting rows for each query have been emitted.
  * **Parameters**: None
	 
# Example

    var pmm = require('./node-poormansmysql'), sys = require('sys');

    var conn = new pmm.MysqlConnection({user: 'foo', password: 'bar', db: 'baz'});
    conn.addListener('error', function(err) {
    	sys.puts('Uh oh, ' + err);
    });
    conn.addListener('row', function(rowdata, sql) {
    	sys.puts("'" + sql + "' generated a row: " + sys.inspect(row));
    });
    conn.addListener('queryDone', function(sql) {
    	sys.puts("Done with query: " + sql);
    });
    conn.addListener('done', function() {
    	sys.puts('Done executing all SQL statements!');
    });
    conn.query("SELECT * FROM table");
    conn.execute();


# License

See LICENSE file.