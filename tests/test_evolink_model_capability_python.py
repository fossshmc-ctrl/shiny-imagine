import os, sys, unittest
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if ROOT not in sys.path: sys.path.insert(0,ROOT)
import server

class EvoLinkModelCapabilityPythonTests(unittest.TestCase):
    def test_normalizes_live_image_capability_metadata(self):
        cap=server.normalize_evolink_model_capability({
            'id':'future-image-model-2026',
            'supported_endpoints':['/v1/images/generations'],
            'input_modalities':['text','image'],
            'output_modalities':['image'],
            'max_input_images':7,
            'aspect_ratios':['1:1','16:9'],
            'resolutions':['1K','3K'],
            'qualities':['draft','hd'],
        })
        self.assertTrue(cap['imageOutput'])
        self.assertTrue(cap['supportsImageInput'])
        self.assertEqual(cap['maxInputImages'],7.0)
        self.assertEqual(cap['aspectRatios'],['1:1','16:9'])
        self.assertEqual(cap['resolutions'],['1K','3K'])
        self.assertEqual(cap['qualities'],['draft','hd'])

    def test_text_only_input_is_explicit(self):
        cap=server.normalize_evolink_model_capability({'id':'new-t2i-image','supported_endpoints':['/v1/images/generations'],'input_modalities':['text'],'output_modalities':['image']})
        self.assertFalse(cap['supportsImageInput'])

if __name__=='__main__': unittest.main()
