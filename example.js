var pmm = require('./node-poormansmysql'), sys = require('sys');

var conn = new pmm.MysqlConnection({user: 'foo', password: 'bar', db: 'baz'});
conn.addListener('error', function(err) {
	sys.puts('Uh oh, ' + err);
});

conn.query("SELECT * FROM table",
	function(row) {
		sys.puts("Got result for first query: " + JSON.stringify(row));
	},
	function() {
		sys.puts("First query is done!");
	},
	function(err) {
		sys.puts("First query resulted in error: " + err);
	}
);
conn.query("SELECT * FROM table2",
	function(row) {
		sys.puts("Got result for second query: " + JSON.stringify(row));
	},
	function() {
		sys.puts("Second query is done!");
	},
	function(err) {
		sys.puts("Second query resulted in error: " + err);
	}
);
conn.execute();
