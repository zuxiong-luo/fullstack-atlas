class HdDurationExceeded(Exception):
    pass


class PricingService:
    def quote(self, seconds: int, quality: str) -> dict:
        if quality == "hd" and seconds > 60:
            raise HdDurationExceeded("HD报价最多支持60秒")
        rate = 4 if quality == "hd" else 2
        return {
            "seconds": seconds,
            "quality": quality,
            "credits": seconds * rate,
            "internal_rule": "demo-rate-v1",
        }
