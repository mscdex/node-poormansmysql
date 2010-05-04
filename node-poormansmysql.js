var spawn = require('child_process').spawn;
var libxml = require('./libxmljs');
var inherits = require('sys').inherits;
var EventEmitter = require('events').EventEmitter;

function mysql_escape(str) {
	return str.replace(/[\\"']/g, "\\$&").replace(/[\n]/g, "\\n").replace(/[\r]/g, "\\r").replace(/\x00/g, "\\0");
}

function MysqlConnection(newconfig) {
	EventEmitter.call(this);
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

	var hasCriticalError = false;
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
					  hasError: false,
					  cbRow: (arguments.length >= 2 && typeof arguments[1] == 'function' ? arguments[1] : null),
					  cbComplete: (arguments.length >= 3 && typeof arguments[2] == 'function' ? arguments[2] : null),
					  cbError: (arguments.length == 4 && typeof arguments[3] == 'function' ? arguments[3] : null)
		});
	}

	this.execute = function(/*cbDone*/) {
		if (queries.length > 0 && config.user != null && config.password != null) {
			cbQueriesComplete = (arguments.length == 1 && typeof arguments[0] == 'function' ? arguments[0] : null);

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
				strQueries += queries[i].query.replace("\\", "\\\\").replace("\"", "\\\"") + (i + 1 < len ? ";\n" : "");

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
					if (completeError) {
						if ((errInfo = /^ERROR ([\d]+?) \((.+?)\) at line ([\d]+?): /.exec(_lastError)) != null) {
							if (queries[errInfo[3]-1].cbError) {
								// The line number indicated in _lastError should be disregarded in callbacks since queries should always be one line
								// and we use the line number internally to track/identify each query
								queries[errInfo[3]-1].cbError(_lastError);
								// Don't notify the user twice
								completeError = false;
							}
							queries[errInfo[3]-1].hasError = true;
						} else
							hasCriticalError = true;
					}
				}

				if (completeError)
					self.emit('error', _lastError);
			});
			proc.addListener('exit', function(code) {
				parser.push("</results>");
				if (!hasCriticalError) {
					var foundError = false;
					// Fire the "complete" callback for any leftover non-select queries that were successful since the MySQL command-line client
					// doesn't give any output for successful non-select queries in batch mode.
					for (var i = 0, len = queries.length; i < len; i++) {
						if (!queries[i].hasError && !(/^select/i.test(queries[i].query)) && queries[i].cbComplete)
							queries[i].cbComplete();
						else if (queries[i].hasError && !foundError)
							foundError = true;
					}
					if (!foundError && cbQueriesComplete)
						cbQueriesComplete();
				}
				queries = [];
				curQueryIdx = 0;
				isInserting = false;
				hasCriticalError = false;
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
			if (elem == "resultset") {
				// Skip bad queries or queries that don't return rows until we get to the one
				// that must be associated with this resultset
				while (queries[curQueryIdx].hasError || !(/^select/i.test(queries[curQueryIdx].query)))
					curQueryIdx++;
			} else if (elem == "row")
				curRow = {};
			else if (elem == "field") {
				curField = attrs[0][3];
				if (attrs.length > 1 && attrs[1][0] == "nil" && attrs[1][3] == "true")
					curRow[curField] = null;
				else
					curRow[curField] = "";
			}
		});
		cb.onEndElementNS(function(elem, prefix, uri) {
			if (elem == "resultset") {
				if (queries[curQueryIdx].cbComplete)
					queries[curQueryIdx].cbComplete();
				curQueryIdx++;
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

exports.escape = mysql_escape;
exports.MysqlConnection = MysqlConnection;