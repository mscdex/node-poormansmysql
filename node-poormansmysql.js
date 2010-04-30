var spawn = require('child_process').spawn;
var libxml = require('./libxmljs');
var inherits = require('sys').inherits;
var EventEmitter = require('events').EventEmitter;

function MysqlConnection(newconfig) {
	var default_config = {
		user: null,
		password: null,
		db: null,
		host: 'localhost',
		port: 3306,
		force: false, // execute ALL queries even if any of the queries results in error(s)
		connect_timeout: 0, // the time to wait for a connection to the MySQL server (in seconds)
		execute_timeout: 0 // the time to wait for ALL queries to execute (in seconds) (TODO)
	};
	var config;

	var queries = [];

	var _lastError = null;
	var _affectedRows = 0;
	var _lastInsertId = 0; // 0 means no row(s) inserted
	var isInserting = false;

	/* Query bookkeeping */
	var curQueryIdx = 0;
	var curRow = null;
	var curField = null;
	var cbQueriesComplete;

	var proc = null;
	var parser;

	var self = this;

	/* Public Methods */

	this.setConfig = function(newconfig) {
		config = {};
		for (var option in default_config)
			config[option] = (typeof newconfig[option] != "undefined" ? newconfig[option] : default_config[option]);
	}

	this.query = function(sql/*, cbRow, cbComplete, cbError*/) {
		if (sql == null || (sql = sql.replace(/^\s*/, "").replace(/\s*$/, "")) == "")
			return;

		if (sql.substr(0, 6).toUpperCase() == "INSERT")
			isInserting = true;
		queries.push({query: sql,
					  cbRow: (arguments.length >= 2 && typeof arguments[1] == 'function' ? arguments[1] : null),
					  cbComplete: (arguments.length >= 3 && typeof arguments[2] == 'function' ? arguments[2] : null),
					  cbError: (arguments.length == 4 && typeof arguments[3] == 'function' ? arguments[3] : null)
		});
	}

	this.execute = function(/*cbDone*/) {
		if (queries.length > 0 && config.user != null && config.password != null) {
			cbQueriesComplete = (arguments.length == 1 && typeof arguments[1] == 'function' ? arguments[1] : null);

			this.query("SELECT ROW_COUNT() AS _node_poormansmysql_affectedRows", function(row) {
				_affectedRows = row['_node_poormansmysql_affectedRows'];
			});
			if (isInserting) {
				this.query("SELECT LAST_INSERT_ID() AS _node_poormansmysql_lastInsertId", function(row) {
					_affectedRows = row['_node_poormansmysql_lastInsertId'];
				});
			}

			var strQueries = "";
			for (var i = 0, len = queries.length; i < len; i++)
				strQueries += queries[i].query.replace("\\", "\\\\").replace('"', '\"') + (i + 1 < len ? "; " : "");

			proc = spawn('/bin/sh', ['-c', 'echo "' + strQueries + '" | mysql --xml --quick --disable-auto-rehash --connect_timeout=' + config.connect_timeout + ' --host=' + config.host + ' --port=' + config.port + ' --user=' + config.user + ' --password=' + config.password + (config.db != null ? ' --database=' + config.db : '') + (config.force == true ? ' --force' : '') + ' | cat']);

			proc.stdout.setEncoding('utf8');
			proc.stderr.setEncoding('utf8');

			proc.stdout.addListener('data', function(data) {
				// UGLY HACK: There is one XML declaration for each MySQL query, so remove the extra ones where applicable, otherwise libxml throws a fit.
				var header = "<?xml version=\"1.0\"?>\n";
				if (data.substr(0, header.length) == header)
					data = header + "<results>\n" + data.substr(header.length);
				data = data.replace("\n" + header, "");
				parser.push(data);
			});
			proc.stderr.addListener('data', function(data) {
				var completeError = true;
				if (/^execvp\(\)/.test(data)) {
					_lastError = 'Spawn Error: Failed to start child process.';
					completeError = true;
				} else {
					// Check for segmented/partial MySQL errors from stderr
					if (data.substr(0, 5) == "ERROR") {
						_lastError = data; //'MySQL Error: ' + data;
						if (data.length == 5)
							completeError = false;
					} else {
						_lastError += data;
						if (data.substr(0, 2) != ": ")
							completeError = false;
					}
					// For now, assume the cause of this MySQL error is the current query.
					// Eventually it'd be ideal to parse the SQLSTATE code to distinguish between query-specific and other (server) errors
					if (completeError) {
						if (queries[curQueryIdx].cbError) {
							queries[curQueryIdx].cbError(_lastError);
							// Don't notify the user twice
							completeError = false;
						}
						curQueryIdx++;
					}
				}

				if (completeError)
					self.emit('error', _lastError);
			});
			proc.addListener('exit', function(code) {
				parser.push("</results>");
				queries = [];
				curQueryIdx = 0;
				isInserting = false;
			});

			return true;
		} else
			return false;
	}

	this.__defineGetter__('affectedRows', function () { return _affectedRows; });
	this.__defineGetter__('lastInsertId', function () { return _lastInsertId; });
	this.__defineGetter__('lastError', function () { return _lastError; });
	
	/* Initialization */

	this.setConfig(newconfig);
	parser = new libxml.SaxPushParser(function(cb) {
		cb.onStartElementNS(function(elem, attrs, prefix, uri, namespaces) {
			if (elem == "row")
				curRow = {};
			else if (elem == "field") {
				curField = attrs[0][3];
				curRow[curField] = null;
			}
		});
		cb.onEndElementNS(function(elem, prefix, uri) {
			if (elem == "resultset") {
				if (queries[curQueryIdx].cbComplete)
					queries[curQueryIdx].cbComplete();
				if (++curQueryIdx == queries.length && cbQueriesComplete)
					cbQueriesComplete();
			} else if (elem == "row") {
				if (queries[curQueryIdx].cbRow)
					queries[curQueryIdx].cbRow(curRow);
				curRow = null;
			} else if (elem == "field")
				curField = null;
		});
		cb.onCharacters(function(chars) {
			if (curField != null) {
				if (curRow[curField] == null)
					curRow[curField] = chars;
				else
					curRow[curField] += chars;
			}
		});
	});
};
inherits(MysqlConnection, EventEmitter);

exports.MysqlConnection = MysqlConnection;