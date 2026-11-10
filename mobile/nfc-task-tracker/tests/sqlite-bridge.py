import json,sqlite3,sys
connection=sqlite3.connect(':memory:',isolation_level=None)
connection.row_factory=sqlite3.Row
for line in sys.stdin:
    try:
        request=json.loads(line)
        if request['kind']=='schema':
            connection.executescript(request['sql']);result=None
        else:
            cursor=connection.execute(request['sql'],request.get('params',[]))
            result=[dict(row) for row in cursor.fetchall()] if request['kind']=='query' else {'changes':cursor.rowcount}
        print(json.dumps({'id':request['id'],'result':result}),flush=True)
    except Exception as error:
        print(json.dumps({'id':request['id'],'error':str(error)}),flush=True)
