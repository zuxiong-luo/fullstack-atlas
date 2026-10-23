"""Run only on loopback by default. Demo bearer tokens are not production auth."""
import os
import uvicorn
if __name__=='__main__':
    uvicorn.run('app:create_app',factory=True,host='127.0.0.1',port=int(os.getenv('PORT','8002')))
