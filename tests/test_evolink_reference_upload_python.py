import unittest
import server

class EvoLinkReferenceUploadPythonTests(unittest.TestCase):
    def test_reference_cache_id_stable_and_key_scoped(self):
        a=server._reference_cache_id(b'abc','key-a')
        b=server._reference_cache_id(b'abc','key-a')
        c=server._reference_cache_id(b'abc','key-b')
        self.assertEqual(a,b)
        self.assertNotEqual(a,c)
        self.assertEqual(len(a),64)

    def test_parse_file_upload_response(self):
        raw=b'{"success":true,"data":{"file_url":"https://files.evolink.ai/a.jpg"}}'
        parsed=server._parse_file_upload(200,raw)
        self.assertTrue(parsed['success'])
        self.assertEqual(parsed['url'],'https://files.evolink.ai/a.jpg')

    def test_protocol_fallback_only_for_transient_http(self):
        self.assertTrue(server._should_protocol_fallback({'status':502}))
        self.assertTrue(server._should_protocol_fallback({'status':408}))
        self.assertFalse(server._should_protocol_fallback({'status':401}))
        self.assertFalse(server._should_protocol_fallback({'status':400}))

if __name__=='__main__':
    unittest.main()
