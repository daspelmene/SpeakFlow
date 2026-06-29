from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse

from schemas.audio import (
    AvailableRoom,
    AvailableRoomsResponse,
    CreateRoomResponse,
    JoinRoomRequest,
    JoinRoomResponse,
    RenegotiateResponse,
    SDPOfferRequest,
    SDPAnswerResponse,
    IceCandidateRequest,
    DisconnectRequest,
)

from utils.audio import AudioService
from utils.jwt import get_current_user
from models.user import User

router = APIRouter(prefix="/audio", tags=["Audio"])

audio_service = AudioService()


@router.post("/create-room", response_model=CreateRoomResponse)
async def create_room(user: User = Depends(get_current_user)):
    room_id = audio_service.create_room()
    return CreateRoomResponse(roomId=room_id)


@router.post("/join", response_model=JoinRoomResponse)
async def join_room(
        data: JoinRoomRequest,
        user: User = Depends(get_current_user),
):
    result = await audio_service.join_room(
        room_id=data.roomId,
        user_id=str(user.id),
        user_name=user.fullname or user.email,
    )
    return JoinRoomResponse(**result)


@router.get("/should-renegotiate", response_model=RenegotiateResponse)
async def should_renegotiate(
        roomId: str,
        userSlot: str,
        user: User = Depends(get_current_user),
):
    needs = audio_service.check_renegotiate(
        room_id=roomId,
        user_slot=userSlot,
    )
    return RenegotiateResponse(renegotiate=needs)


@router.post("/offer", response_model=SDPAnswerResponse)
async def handle_offer(
        data: SDPOfferRequest,
        user: User = Depends(get_current_user),
):
    # handles webrtc sdp offer
    result = await audio_service.handle_offer(
        room_id=data.roomId,
        user_slot=data.userSlot,
        sdp=data.sdp,
        offer_type=data.type,
    )
    return SDPAnswerResponse(**result)


@router.post("/ice-candidate")
async def handle_ice_candidate(
        data: IceCandidateRequest,
        user: User = Depends(get_current_user),
):
    # handles ice candidate
    await audio_service.handle_ice(
        room_id=data.roomId,
        user_slot=data.userSlot,
        candidate_data=data.candidate.model_dump(),
    )
    return JSONResponse({"status": "ok"})


@router.get("/available-rooms", response_model=AvailableRoomsResponse)
async def get_available_rooms(user_id: str = Depends(get_current_user)):
    rooms = audio_service.get_available_rooms()
    return AvailableRoomsResponse(rooms=[AvailableRoom(**r) for r in rooms])


@router.post("/disconnect")
async def disconnect(
        data: DisconnectRequest,
        user: User = Depends(get_current_user),
):
    await audio_service.disconnect(room_id=data.roomId)
    return JSONResponse({"status": "disconnected"})
