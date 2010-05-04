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