import importlib.util, os, unittest
from unittest import mock
ROOT=os.path.abspath(os.path.join(os.path.dirname(__file__),'..'))
spec=importlib.util.spec_from_file_location('v2623_server',os.path.join(ROOT,'server.py'))
server=importlib.util.module_from_spec(spec);spec.loader.exec_module(server)

class TestNetworkResilience(unittest.TestCase):
    def test_connection_reset_is_transient(self):
        info=server.classify_network_error(ConnectionResetError(104,'Connection reset by peer'))
        self.assertEqual(info['kind'],'connection_reset')
        self.assertTrue(info['transient'])
    def test_pre_tls_disconnect_is_transient(self):
        info=server.classify_network_error(Exception('Client network socket disconnected before secure TLS connection was established'))
        self.assertEqual(info['kind'],'tls_handshake')
        self.assertTrue(info['transient'])
    def test_apifox_failure_is_advisory_when_real_evolink_routes_pass(self):
        def advisory_fail(*_args,**_kwargs):
            raise Exception('Client network socket disconnected before secure TLS connection was established')
        def evolink_ok(*_args,**_kwargs):
            return 200,{'content-type':'application/json'},b'{}'
        with mock.patch.object(server,'request_external_on_route',side_effect=advisory_fail), mock.patch.object(server,'request_micro_external',side_effect=evolink_ok):
            result=server.run_network_diagnostics('test-key',deep=False,micro_channel=True)
        self.assertTrue(result['ok'])
        self.assertTrue(result['warning'])
        self.assertEqual(result['steps'][0]['required'],False)
        self.assertEqual(result['steps'][0]['code'],'tls_handshake')
        self.assertTrue(all(step['ok'] for step in result['steps'] if step['required']))
    def test_data_url_to_multipart(self):
        raw,mime,name=server.decode_image_data_url('data:image/png;base64,MTIzNDU=')
        self.assertEqual(raw,b'12345');self.assertEqual(mime,'image/png')
        body,ctype=server.build_multipart_file(raw,mime,'probe.png')
        self.assertIn(b'name="file"; filename="probe.png"',body)
        self.assertIn(b'Content-Type: image/png',body)
        self.assertIn('multipart/form-data; boundary=',ctype)
    def test_retryable_http_set(self):
        self.assertIn(502,server.RETRYABLE_HTTP);self.assertIn(504,server.RETRYABLE_HTTP)
        self.assertNotIn(400,server.RETRYABLE_HTTP)

if __name__=='__main__':unittest.main()
