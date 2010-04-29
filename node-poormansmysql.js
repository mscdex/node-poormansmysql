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
		connect_timeout: 0, // in seconds
		query_timeout: 0 // in seconds (TODO)
	};
	var config;

	var queries = [];

	var _affectedRows = 0;
	var _lastInsertId = 0; // 0 means no row(s) inserted
	var isInserting = false;

	/* Bookkeeping */
	var curQuery = null;
	var curRow = null;
	var curField = null;
	var queryTotal = 0;
	var queryCount = 0;
	var lastIndex = 0;

	var lastError = null;

	var proc = null;
	var parser;

	var self = this;

	/* Public Methods */

	this.setConfig = function(newconfig) {
		config = {};
		for (var option in default_config)
			config[option] = (typeof newconfig[option] != "undefined" ? newconfig[option] : default_config[option]);
	}

	this.query = function(sql) {
		sql = sql.replace(/^\s*/, "").replace(/\s*$/, "").replace('"', '\"');
		queries.push(sql);
		if (sql.substr(0, 6).toUpperCase() == "INSERT")
			isInserting = true;
	}

	this.execute = function() {
		if (queries.length > 0 && config.user != null && config.password != null) {
			queries.push("SELECT ROW_COUNT() AS _node_poormansmysql_affectedRows");
			if (isInserting) {
				queries.push("SELECT LAST_INSERT_ID() AS _node_poormansmysql_lastInsertId");
				lastIndex = queries.length-3;
			} else
				lastIndex = queries.length-2;

			proc = spawn('/bin/sh', ['-c', 'mysql --xml --quick --disable-auto-rehash --connect_timeout=' + config.connect_timeout + ' --host=' + config.host + ' --port=' + config.port + ' --user=' + config.user + ' --password=' + config.password + (config.db != null ? ' --database=' + config.db : '') + ' --execute="' + queries.join('; ') + '"']);

			proc.stdout.setEncoding('utf8');
			proc.stderr.setEncoding('utf8');

			proc.stdout.addListener('data', function(data) {
				// UGLY HACK: There is one XML declaration for each MySQL query, so remove the extra ones where applicable, otherwise libxml throws a fit.
				var header = "<?xml version=\"1.0\"?>\n";
				if (queryCount == 0 && data.substr(0, header.length) == header)
					data = header + "<results>\n" + data.substr(header.length);
				data = data.replace("\n" + header, "");
				parser.push(data);
			});
			proc.stderr.addListener('data', function(data) {
				if (/^execvp\(\)/.test(data))
					lastError = 'Spawn Error: Failed to start child process.';
				else
					lastError = 'MySQL Error: ' + data;

				self.emit('error', lastError);
			});
			proc.addListener('exit', function(code) {
				if (code == 0) {
					parser.push("</results>");
					queryCount = 0;
				}
			});

			queryTotal = queries.length;
			queries = [];
			isInserting = false;
			return true;
		} else
			return false;
	}

	this.__defineGetter__('affectedRows', function () { return _affectedRows; });
	this.__defineGetter__('lastInsertId', function () { return _lastInsertId; });
	
	/* Initialization */

	this.setConfig(newconfig);
	parser = new libxml.SaxPushParser(function(cb) {
		cb.onStartElementNS(function(elem, attrs, prefix, uri, namespaces) {
			if (elem == "resultset")
				curQuery = attrs[0][3];
			else if (elem == "row")
				curRow = {};
			else if (elem == "field") {
				curField = attrs[0][3];
				curRow[curField] = null;
			}
		});
		cb.onEndElementNS(function(elem, prefix, uri) {
			if (elem == "resultset") {
				if (queryCount <= lastIndex)
					self.emit('queryDone', curQuery);
				curQuery = null;
				if (++queryCount == queryTotal)
					self.emit('done');
			} else if (elem == "row") {
				if (typeof curRow['_node_poormansmysql_lastInsertId'] != 'undefined')
					_lastInsertId = curRow['_node_poormansmysql_lastInsertId'];
				else if (typeof curRow['_node_poormansmysql_affectedRows'] != 'undefined')
					_affectedRows = curRow['_node_poormansmysql_affectedRows'];
				else
					self.emit('row', curRow, curQuery);
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