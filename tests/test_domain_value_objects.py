"""Unit tests for RailNexus domain value objects (KmRange, TimeWindow, Department)."""

from datetime import datetime, timezone, timedelta
import unittest

from backend.domain.exceptions import InvalidKmRangeError, InvalidTimeWindowError
from backend.domain.value_objects import KmRange, TimeWindow, normalize_department
from backend.domain.enums import Department


class TestKmRange(unittest.TestCase):
    def test_valid_km_range(self):
        kr = KmRange(start_km=10.0, end_km=15.5)
        self.assertEqual(kr.start_km, 10.0)
        self.assertEqual(kr.end_km, 15.5)
        self.assertEqual(kr.length_km, 5.5)

    def test_zero_length_km_range_is_valid(self):
        # A single point (e.g. signal or point machine)
        kr = KmRange(start_km=21.3, end_km=21.3)
        self.assertEqual(kr.length_km, 0.0)
        self.assertTrue(kr.contains(21.3))

    def test_negative_start_km_rejected(self):
        with self.assertRaises(InvalidKmRangeError):
            KmRange(start_km=-1.0, end_km=10.0)

    def test_end_km_less_than_start_km_rejected(self):
        with self.assertRaises(InvalidKmRangeError):
            KmRange(start_km=15.0, end_km=10.0)

    def test_contains(self):
        kr = KmRange(start_km=10.0, end_km=20.0)
        self.assertTrue(kr.contains(10.0))
        self.assertTrue(kr.contains(15.0))
        self.assertTrue(kr.contains(20.0))
        self.assertFalse(kr.contains(9.99))
        self.assertFalse(kr.contains(20.01))

    def test_overlaps(self):
        kr1 = KmRange(10.0, 20.0)
        kr2 = KmRange(15.0, 25.0)
        kr3 = KmRange(20.0, 30.0) # touches at 20.0
        kr4 = KmRange(25.0, 35.0) # disjoint

        self.assertTrue(kr1.overlaps(kr2))
        self.assertTrue(kr2.overlaps(kr1))
        self.assertTrue(kr1.overlaps(kr3))
        self.assertFalse(kr1.overlaps(kr4))

    def test_distance_to(self):
        kr1 = KmRange(10.0, 15.0)
        kr2 = KmRange(18.5, 25.0)
        kr3 = KmRange(12.0, 16.0) # overlapping

        self.assertEqual(kr1.distance_to(kr2), 3.5)
        self.assertEqual(kr2.distance_to(kr1), 3.5)
        self.assertEqual(kr1.distance_to(kr3), 0.0)

    def test_merge_with(self):
        kr1 = KmRange(10.0, 15.0)
        kr2 = KmRange(18.0, 25.0)
        merged = kr1.merge_with(kr2)
        self.assertEqual(merged.start_km, 10.0)
        self.assertEqual(merged.end_km, 25.0)
        self.assertEqual(merged.length_km, 15.0)


class TestTimeWindow(unittest.TestCase):
    def setUp(self):
        self.base_time = datetime(2026, 9, 26, 10, 0, tzinfo=timezone.utc)

    def test_valid_time_window(self):
        tw = TimeWindow(
            start_time=self.base_time,
            end_time=self.base_time + timedelta(minutes=120),
        )
        self.assertEqual(tw.duration_minutes, 120.0)
        self.assertEqual(tw.duration_hours, 2.0)

    def test_equal_start_and_end_rejected(self):
        with self.assertRaises(InvalidTimeWindowError):
            TimeWindow(start_time=self.base_time, end_time=self.base_time)

    def test_end_before_start_rejected(self):
        with self.assertRaises(InvalidTimeWindowError):
            TimeWindow(
                start_time=self.base_time,
                end_time=self.base_time - timedelta(minutes=30),
            )

    def test_contains(self):
        tw = TimeWindow(self.base_time, self.base_time + timedelta(hours=2))
        self.assertTrue(tw.contains(self.base_time))
        self.assertTrue(tw.contains(self.base_time + timedelta(hours=1)))
        self.assertTrue(tw.contains(self.base_time + timedelta(hours=2)))
        self.assertFalse(tw.contains(self.base_time - timedelta(seconds=1)))
        self.assertFalse(tw.contains(self.base_time + timedelta(hours=2, seconds=1)))

    def test_overlaps_and_overlap_minutes(self):
        tw1 = TimeWindow(self.base_time, self.base_time + timedelta(hours=2))
        tw2 = TimeWindow(self.base_time + timedelta(hours=1), self.base_time + timedelta(hours=3))
        tw3 = TimeWindow(self.base_time + timedelta(hours=2), self.base_time + timedelta(hours=4)) # adjacent touches at boundary
        tw4 = TimeWindow(self.base_time + timedelta(hours=3), self.base_time + timedelta(hours=5)) # disjoint

        self.assertTrue(tw1.overlaps(tw2))
        self.assertEqual(tw1.overlap_minutes(tw2), 60.0)

        # Touching boundary is strictly non-overlapping in time interval
        self.assertFalse(tw1.overlaps(tw3))
        self.assertEqual(tw1.overlap_minutes(tw3), 0.0)

        self.assertFalse(tw1.overlaps(tw4))
        self.assertEqual(tw1.overlap_minutes(tw4), 0.0)

    def test_shift_and_extend(self):
        tw = TimeWindow(self.base_time, self.base_time + timedelta(hours=2))
        shifted = tw.shift_by(30)
        self.assertEqual(shifted.start_time, self.base_time + timedelta(minutes=30))
        self.assertEqual(shifted.end_time, self.base_time + timedelta(minutes=150))
        self.assertEqual(shifted.duration_minutes, 120.0)

        extended = tw.extend_by(30)
        self.assertEqual(extended.start_time, self.base_time)
        self.assertEqual(extended.end_time, self.base_time + timedelta(minutes=150))
        self.assertEqual(extended.duration_minutes, 150.0)


class TestDepartmentValueObject(unittest.TestCase):
    def test_normalization(self):
        self.assertEqual(normalize_department("engg"), Department.ENGG)
        self.assertEqual(normalize_department("P.WAY"), Department.ENGG)
        self.assertEqual(normalize_department("trd"), Department.TRD)
        self.assertEqual(normalize_department("traction"), Department.TRD)
        self.assertEqual(normalize_department("s&t"), Department.SNT)
        self.assertEqual(normalize_department("snt"), Department.SNT)
        self.assertEqual(normalize_department(Department.ENGG), Department.ENGG)

    def test_invalid_department_raises(self):
        with self.assertRaises(ValueError):
            normalize_department("CATERING")


if __name__ == "__main__":
    unittest.main()
