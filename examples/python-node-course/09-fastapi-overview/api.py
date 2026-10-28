from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, Request
from schemas import QuoteInput, QuoteOutput
from service import HdDurationExceeded, PricingService

router = APIRouter(prefix="/api", tags=["quotes"])


def get_pricing_service(request: Request) -> PricingService:
    return request.app.state.pricing


@router.post("/quotes", response_model=QuoteOutput)
def create_quote(
    body: QuoteInput,
    pricing: Annotated[PricingService, Depends(get_pricing_service)],
):
    try:
        return pricing.quote(body.seconds, body.quality)
    except HdDurationExceeded as error:
        raise HTTPException(
            status_code=409,
            detail={"code": "HD_LIMIT", "message": str(error)},
        ) from error
