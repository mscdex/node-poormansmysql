# node-poormansmysql

node-poormansmysql is a MySQL driver for [node.js](http://nodejs.org/) that executes queries using the mysql command-line client.


# Requirements

* [node.js 0.1.92+](http://nodejs.org/)
* [libxmljs](http://github.com/polotek/libxmljs) -- tested with [7903666cd29001b19fb0](http://github.com/polotek/libxmljs/commit/7903666cd29001b19fb0821f62bcf50f6b5576b3)
    * Note: libxmljs.node should be placed in the same directory as the node-poormansmysql.js module.


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
				force: false, // execute ALL queries in the case of a query error
                connect_timeout: 0, // the time to wait for a connection to the MySQL server (in seconds)
                execute_timeout: 0 // the time to wait for ALL queries to execute (in seconds) (TODO)
    * **Return Value**: (MysqlConnection) An instance of MysqlConnection.
* **setConfig**(_config_)
    * **Description**: Sets the connection configuration. This is only needed if you are reusing the instance and need to change the connection information. As with the constructor, all properties supplied in _config_ are merged with the defaults.
    * **Parameters**: 
        * _config_: (Object) An object containing the necessary connection information to connect to the MySQL server and perform queries. At least the user and password should be supplied. See above for the default configuration.
    * **Return Value**: None
* **query**(_sql_ [, _cbRow_[, _cbComplete_[, _cbError_]]])
    * **Description**: Enqueues an SQL statement.
    * **Parameters**:
        * _sql_: (String) A valid SQL statement. Do not include a trailing semicolon at the end of the statement.
        * _cbRow_ (Optional): (Function) A callback for when a row resulted from the query.
            * **Parameters**:
                * _row_: (Object) A hash containing a single row from the results of the query.
        * _cbComplete_ (Optional): (Function) A callback for when the query has completed and all rows have been returned.
            * **Parameters**:
                * _totalRows_: (Integer) The total number of rows returned by the query.
        * _cbError_ (Optional): (Function) A callback for when the query results in a MySQL error.
            * **Parameters**:
                * _err_: (String) The entire MySQL error message.
    * **Return Value**: None
* **execute**([_cbQueriesComplete_])
    * **Description**: Begins executing the enqueued SQL statements all at once.
    * **Parameters**:
        * _cbQueriesComplete_ (Optional): (Function) A callback that is called when each query in the queue has completed.
            * **Parameters**: None
    * **Return Value**: (Boolean) _true_ if there were statements to be executed and the 'user' and 'password' connection details have been supplied, _false_ otherwise.
* (getter) **affectedRows**
    * **Description**: Returns the number of rows updated, inserted, or deleted by the last SQL statement.
    * **Return Value**: (Integer) The number of rows affected by the last SQL statement.
* (getter) **lastInsertId**
    * **Description**: Returns the first automatically generated value that was set for an AUTO_INCREMENT column by the most recent INSERT statement. See [here](http://dev.mysql.com/doc/refman/5.0/en/information-functions.html#function_last-insert-id) for more details.
    * **Return Value**: (Integer) The value of the AUTO_INCREMENT column for the last INSERTed row.
* (getter) **lastError**
    * **Description**: Returns the last error set by the MysqlConnection instance (either a child process spawn error or a MySQL error).
    * **Return Value**: (String) The value of the last error.

MysqlConnection Events:

* **error**
    * **Description**: Fired when an error occurs. This can be either a non-query-specific (i.e. system or server-specific) MySQL error or a child process spawning error.
    * **Parameters**:
        * _err_: (String) The error details.

Utility methods exposed:

* **escape**(str)
    * **Description**: Performs <u>basic</u> string escaping, similar to the PHP function mysql_escape_string.
    * **Parameters**:
        * _str_: (String) The string to escape.


# Example

    var pmm = require('./node-poormansmysql'), sys = require('sys');

	var fieldvalue = "o'reilly";
    var conn = new pmm.MysqlConnection({user: 'foo', password: 'bar', db: 'baz'});

    conn.addListener('error', function(err) {
    	sys.puts('Uh oh, ' + err);
    });

    conn.query("SELECT * FROM table",
    	function(row) {
    		sys.puts("Got result for first query: " + JSON.stringify(row));
    	},
    	function(totalRows) {
    		sys.puts("First query is done! Retrieved " + totalRows + " row(s)");
    	},
    	function(err) {
    		sys.puts("First query resulted in error: " + err);
    	}
    );
    conn.query("SELECT * FROM table2 WHERE field = '" + pmm.escape(fieldvalue) + "'",
    	function(row) {
    		sys.puts("Got result for second query: " + JSON.stringify(row));
    	},
    	function(totalRows) {
    		sys.puts("Second query is done! Retrieved " + totalRows + " row(s)");
    	},
    	function(err) {
    		sys.puts("Second query resulted in error: " + err);
    	}
    );
    conn.execute();


# License

See LICENSE file.