"""原版人物保护与阅读测量的离线回归。"""
import shutil
import tempfile
import unittest
from pathlib import Path

from verify_readability import APP, ORIGINAL_ART_SHA256, check_original_art, contrast


class ReadabilityContractTests(unittest.TestCase):
    def test_original_art_matches_pinned_hashes(self):
        self.assertEqual(check_original_art(APP), ORIGINAL_ART_SHA256)

    def test_same_name_replacement_is_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            for relative in ORIGINAL_ART_SHA256:
                target = root / relative
                target.parent.mkdir(parents=True, exist_ok=True)
                shutil.copyfile(APP / relative, target)
            target = root / 'assets/heroine/yue/night.webp'
            target.write_bytes(target.read_bytes() + b'changed-art')
            with self.assertRaisesRegex(AssertionError, 'heroine/yue/night.webp'):
                check_original_art(root)

    def test_contrast_reference_values(self):
        self.assertAlmostEqual(contrast((0, 0, 0), (255, 255, 255)), 21)
        self.assertAlmostEqual(contrast((48, 58, 73), (48, 58, 73)), 1)
        self.assertGreater(contrast((234, 219, 197), (48, 58, 73)), 8)


if __name__ == '__main__':
    unittest.main()
