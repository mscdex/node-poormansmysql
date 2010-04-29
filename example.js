var pmm = require('./node-poormansmysql'), sys = require('sys');

var conn = new pmm.MysqlConnection({user: 'foo', password: 'bar', db: 'baz'});
conn.addListener('error', function(err) {
	sys.puts('Uh oh, ' + err);
});
conn.addListener('row', function(rowdata, sql) {
	sys.puts("'" + sql + "' generated a row: " + sys.inspect(rowdata));
});
conn.addListener('queryDone', function(sql) {
	sys.puts("Done with query: " + sql);
});
conn.addListener('done', function() {
	sys.puts('Done executing all SQL statements!');
});
conn.query("SELECT * FROM table");
conn.execute();
