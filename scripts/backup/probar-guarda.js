// Prueba de la lista blanca de solo lectura: lo permitido pasa y cada sentencia peligrosa lanza. Sin base de datos.
const assert = require('assert');
const { clasificar } = require('./guardaSoloLectura');

const permitidas = [
  'SELECT COUNT(*) AS n FROM `t`',
  'SELECT a FROM t WHERE x = ?',
  'SELECT `into` FROM `for update`',
  "SELECT 'texto INTO y FOR UPDATE' AS v",
  'SHOW CREATE TABLE `t`',
  'SHOW CREATE VIEW `v`',
  'SET SESSION TRANSACTION READ ONLY',
  'SET SESSION TRANSACTION ISOLATION LEVEL REPEATABLE READ',
  "SET time_zone = '+00:00'",
  'SET NAMES utf8mb4',
  'START TRANSACTION WITH CONSISTENT SNAPSHOT',
  'START TRANSACTION',
  'COMMIT',
  'ROLLBACK'
];

const prohibidas = [
  'INSERT INTO t VALUES (1)', 'UPDATE t SET a = 1', 'DELETE FROM t', 'REPLACE INTO t VALUES (1)',
  'CREATE TABLE x (a INT)', 'CREATE TEMPORARY TABLE x (a INT)', 'ALTER TABLE t ADD c INT', 'DROP TABLE t', 'TRUNCATE t',
  'RENAME TABLE a TO b', 'GRANT ALL ON *.* TO x', 'FLUSH TABLES WITH READ LOCK', 'FLUSH TABLES', 'LOCK TABLES t READ', 'UNLOCK TABLES',
  "SELECT GET_LOCK('x', 1)", "SELECT RELEASE_LOCK('x')", 'CALL p()', "LOAD DATA INFILE 'f' INTO TABLE t",
  "SELECT * FROM t INTO OUTFILE '/tmp/x'", 'SELECT a INTO @v FROM t', 'SELECT * FROM t FOR UPDATE', 'SELECT * FROM t LOCK IN SHARE MODE',
  "SELECT LOAD_FILE('/etc/passwd')", 'SELECT SLEEP(5)', 'SET GLOBAL read_only = 0', 'SET SESSION TRANSACTION READ WRITE',
  'SET SESSION transaction_read_only = 0', 'SET @@global.max_connections = 1', 'START TRANSACTION READ WRITE', 'BEGIN',
  'SELECT 1; DROP TABLE t', 'SELECT 1; SELECT 2', '/* x */ DELETE FROM t', 'INSERT/**/INTO t VALUES (1)', 'USE otra', 'KILL 1',
  'SET PASSWORD = ""', 'ANALYZE TABLE t', 'OPTIMIZE TABLE t', 'EXPLAIN DELETE FROM t', 'DO 1', 'PREPARE s FROM "DELETE FROM t"', '', null
];

for (const s of permitidas) clasificar(s);
for (const s of prohibidas) assert.throws(() => clasificar(s), /Respaldo solo lectura/, `debió rechazar: ${s}`);
console.log(`[Respaldo] Guarda de solo lectura: ${permitidas.length} sentencias permitidas pasan y ${prohibidas.length} prohibidas lanzan.`);
process.exit(0);
