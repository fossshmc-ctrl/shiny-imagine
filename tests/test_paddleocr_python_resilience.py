import json
import os
import sys
import threading
import time
import unittest

ROOT=os.path.abspath(os.path.join(os.path.dirname(__file__),'..'))
if ROOT not in sys.path: sys.path.insert(0,ROOT)
import paddleocr_cloud_service as svc


def response(status,obj,headers=None):
    return status,headers or {},json.dumps(obj,ensure_ascii=False).encode('utf-8')


class PaddlePythonResilienceTests(unittest.TestCase):
    def setUp(self):
        svc.SESSION_TOKEN='test_token_abcdefghijklmnopqrstuvwxyz'
        with svc._SUBMISSION_COND:
            svc._SUBMISSION_QUEUE.clear()
            svc._SUBMISSION_STATES.clear()
            svc._SUBMISSION_ACTIVE=''

    def cfg(self):
        return {'paddleOcrCloud':{
            'jobUrl':'https://example.test/api/v2/ocr/jobs',
            'model':'PaddleOCR-VL-1.6',
            'pollIntervalMs':1000,
            'pollTimeoutMs':30000,
            'maxRegions':40,
            'submitRetryDelaysMs':[0,0,0,0],
            'submitRetryJitterMs':0,
        }}

    def image(self):
        import base64
        return 'data:image/png;base64,'+base64.b64encode(b'fake-image').decode('ascii')

    def test_classifies_10010_as_queue_busy(self):
        c=svc._classify_submit_response(400,{},json.dumps({'code':10010,'msg':'任务提交队列已满，请稍后重试'}).encode())
        self.assertEqual(c['code'],'queue_busy')
        self.assertTrue(c['transient'])

    def test_retries_10010_then_succeeds(self):
        calls={'post':0,'get':0}
        original_request=svc._request
        original_download=svc._download_presigned
        def fake_request(method,url,headers,body,timeout,proxy_url):
            if method=='POST':
                calls['post']+=1
                if calls['post']==1:
                    return response(400,{'code':10010,'msg':'任务提交队列已满，请稍后重试'})
                return response(200,{'code':0,'data':{'jobId':'job-python'}})
            calls['get']+=1
            return response(200,{'code':0,'data':{'state':'done','extractProgress':{},'resultUrl':{'jsonUrl':'https://download.test/result.jsonl'}}})
        def fake_download(url,proxy):
            return 200,{},b'{"result":{"layoutParsingResults":[]}}\n',{'attempts':[{'round':1,'via':'direct','status':200}],'via':'direct'}
        try:
            svc._request=fake_request
            svc._download_presigned=fake_download
            out=svc.recognize({'requestId':'py-retry','image':self.image(),'imageWidth':100,'imageHeight':100,'submitRetryDelaysMs':[0,0,0,0],'submitRetryJitterMs':0},self.cfg(),'')
        finally:
            svc._request=original_request
            svc._download_presigned=original_download
        self.assertTrue(out['ok'])
        self.assertEqual(out['submitAttempts'],2)
        self.assertEqual(out['submitDiagnostics'][0]['providerCode'],10010)
        self.assertEqual(calls['post'],2)
        self.assertEqual(svc.submission_queue_status('py-retry')['state']['phase'],'done')

    def test_submission_queue_is_fifo(self):
        order=[]
        gate=threading.Event()
        def work1():
            order.append('one-start')
            gate.wait(1)
            order.append('one-end')
            return 1
        def work2():
            order.append('two-start')
            order.append('two-end')
            return 2
        result={}
        t1=threading.Thread(target=lambda: result.setdefault('one',svc._run_submission_queued('py-one',work1)))
        t2=threading.Thread(target=lambda: result.setdefault('two',svc._run_submission_queued('py-two',work2)))
        t1.start();time.sleep(0.03);t2.start();time.sleep(0.03)
        self.assertEqual(svc.submission_queue_status('py-two')['state']['phase'],'queued')
        self.assertEqual(order,['one-start'])
        gate.set();t1.join(1);t2.join(1)
        self.assertEqual(order,['one-start','one-end','two-start','two-end'])
        self.assertEqual(result,{'one':1,'two':2})


if __name__=='__main__':
    unittest.main()
