import unittest
import server

class EvoLinkCreditReadinessPythonTests(unittest.TestCase):
    def test_zero_account_or_token_credit_blocks_generation(self):
        info = server.evolink_credits_payload({
            'success': True,
            'data': {
                'token': {'remaining_credits': 0, 'used_credits': 5, 'unlimited_credits': False},
                'user': {'remaining_credits': 12, 'used_credits': 3},
            },
        }, 200)
        self.assertTrue(info['checked'])
        self.assertTrue(info['blocked'])
        self.assertFalse(info['generationReady'])
        self.assertEqual(info['effectiveRemaining'], 0)

    def test_positive_credits_are_generation_ready(self):
        info = server.evolink_credits_payload({
            'success': True,
            'data': {
                'token': {'remaining_credits': 8.5, 'used_credits': 1.5, 'unlimited_credits': False},
                'user': {'remaining_credits': 20, 'used_credits': 4},
            },
        }, 200)
        self.assertTrue(info['checked'])
        self.assertFalse(info['blocked'])
        self.assertTrue(info['generationReady'])
        self.assertEqual(info['effectiveRemaining'], 8.5)

    def test_unlimited_token_still_respects_account_balance(self):
        info = server.evolink_credits_payload({
            'success': True,
            'data': {
                'token': {'remaining_credits': 0, 'unlimited_credits': True},
                'user': {'remaining_credits': 4.25},
            },
        }, 200)
        self.assertFalse(info['blocked'])
        self.assertTrue(info['generationReady'])
        self.assertEqual(info['effectiveRemaining'], 4.25)

    def test_unrecognized_credit_payload_is_not_marked_checked(self):
        info = server.evolink_credits_payload({'success': True, 'data': {}}, 200)
        self.assertFalse(info['checked'])
        self.assertFalse(info['recognized'])
        self.assertFalse(info['generationReady'])

if __name__ == '__main__':
    unittest.main()
