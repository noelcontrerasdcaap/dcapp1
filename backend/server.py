from fastapi import FastAPI, APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional
import uuid
from datetime import datetime, timedelta
from jose import JWTError, jwt
from passlib.context import CryptContext
from bson import ObjectId

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get('DB_NAME', 'dcapp_db')]

# JWT Configuration
SECRET_KEY = os.environ.get('JWT_SECRET', 'dcapp_secret_key_2024_v1')
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7 days

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()

# Create the main app
app = FastAPI(title="DCAPP V1 API")
api_router = APIRouter(prefix="/api")

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ==================== MODELS ====================

# Constants
AGENCIES = ["Meridien", "Jetour", "Cadillac"]
ROLES = ["DCA", "Asesor Digital", "Gerente de Ventas", "Gerente de Ventas Digitales", "Marketing", "Trafficker Digital", "Gerente General", "Director"]
FUNNEL_STAGES = ["Lead", "Contactado", "Citado", "Cumplida", "Demo", "Cierre", "Facturada"]
SALE_TYPES = ["Contado", "Crédito", "Arrendamiento", "Flotilla"]
ORIGINS = ["Facebook", "Instagram", "Google Ads", "Página Web", "WhatsApp", "Referido", "Lead/Planta", "Ads/Cronozz", "Ads/Web/Cronozz"]

# Campaign constants
CAMPAIGN_CHANNELS = ["Planta", "Facebook Ads", "Web Ads"]
CAMPAIGN_PROVIDERS = ["Cronozz", "Interno"]
CAMPAIGN_TYPES = ["Lead / Planta", "Ads / Facebook / Cronozz", "Ads / Web / Cronozz"]
CAMPAIGN_STATUSES = ["Planeada", "Activa", "Finalizada"]

# Roles that can view marketing dashboard
ROLES_VIEW_MARKETING = ["Director", "Gerente de Ventas Digitales", "Gerente General", "Marketing", "Gerente de Ventas"]

# Roles that can manage campaigns
ROLES_MANAGE_CAMPAIGNS = ["Gerente de Ventas Digitales"]

# Health thresholds
HEALTH_THRESHOLDS = {
    "Contactado": 90,
    "Citado": 60,
    "Cumplida": 65,
    "Cierre": 25
}

class Token(BaseModel):
    access_token: str
    token_type: str

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    name: str
    role: str
    agency: str
    agencies: Optional[List[str]] = None

class UserUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    password: Optional[str] = None
    role: Optional[str] = None
    agency: Optional[str] = None
    agencies: Optional[List[str]] = None
    active: Optional[bool] = None

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: str
    email: str
    name: str
    role: str
    agency: str
    agencies: Optional[List[str]] = None
    active: bool = True
    created_at: datetime

class LeadCreate(BaseModel):
    name: str
    phone: str
    agency: str
    origin: str
    campaign: Optional[str] = ""
    campaign_id: Optional[str] = None
    dca_id: str

class LeadUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    stage: Optional[str] = None
    origin: Optional[str] = None
    campaign: Optional[str] = None
    campaign_id: Optional[str] = None
    dca_id: Optional[str] = None
    asesor_id: Optional[str] = None
    agency: Optional[str] = None
    notes: Optional[str] = None

class LeadResponse(BaseModel):
    id: str
    name: str
    phone: str
    agency: str
    origin: str
    campaign: str
    campaign_id: Optional[str] = None
    campaign_name: Optional[str] = None
    stage: str
    dca_id: str
    dca_name: Optional[str] = None
    asesor_id: Optional[str] = None
    asesor_name: Optional[str] = None
    created_at: datetime
    created_by: str
    created_by_name: Optional[str] = None
    updated_at: Optional[datetime] = None
    stage_history: List[dict] = []
    notes: Optional[str] = None

class SaleCreate(BaseModel):
    lead_id: str
    marca: str
    modelo: str
    version: str
    precio: float
    cantidad: int = 1
    tipo_venta: str
    asesor_id: str
    dca_id: str
    origen: str
    campaign: str
    facturado_a: str
    fecha_factura: datetime

class SaleResponse(BaseModel):
    id: str
    lead_id: str
    lead_name: str
    lead_phone: Optional[str] = None
    marca: str
    modelo: str
    version: str
    precio: float
    cantidad: int = 1
    monto_total: Optional[float] = None
    tipo_venta: str
    asesor_id: str
    asesor_name: str
    dca_id: str
    dca_name: str
    agency: str
    origen: str
    campaign: str
    facturado_a: str
    fecha_factura: datetime
    created_at: datetime
    lead_created_at: Optional[datetime] = None
    time_to_sale_days: Optional[int] = None

# Campaign Models
class CampaignCreate(BaseModel):
    nombre: str
    agencia: str
    canal: str
    proveedor: str
    tipo_campana: str
    fecha_oferta_comercial: Optional[datetime] = None
    fecha_aprobacion: Optional[datetime] = None
    fecha_activacion: Optional[datetime] = None
    fecha_finalizacion: Optional[datetime] = None
    estado: str = "Planeada"
    presupuesto: float = 0.0
    moneda: str = "MXN"

class CampaignUpdate(BaseModel):
    nombre: Optional[str] = None
    agencia: Optional[str] = None
    canal: Optional[str] = None
    proveedor: Optional[str] = None
    tipo_campana: Optional[str] = None
    fecha_oferta_comercial: Optional[datetime] = None
    fecha_aprobacion: Optional[datetime] = None
    fecha_activacion: Optional[datetime] = None
    fecha_finalizacion: Optional[datetime] = None
    estado: Optional[str] = None
    presupuesto: Optional[float] = None
    moneda: Optional[str] = None

class CampaignResponse(BaseModel):
    id: str
    nombre: str
    agencia: str
    canal: str
    proveedor: str
    tipo_campana: str
    fecha_oferta_comercial: Optional[datetime] = None
    fecha_aprobacion: Optional[datetime] = None
    fecha_activacion: Optional[datetime] = None
    fecha_finalizacion: Optional[datetime] = None
    estado: str
    presupuesto: float = 0.0
    moneda: str = "MXN"
    # Métricas calculadas
    dias_activos: int = 0
    leads_generados: int = 0
    leads_por_dia: float = 0.0
    ventas_atribuidas: int = 0
    monto_vendido: float = 0.0
    costo_por_lead: float = 0.0
    costo_por_venta: float = 0.0
    roi: float = 0.0
    created_at: datetime
    updated_at: Optional[datetime] = None

# ==================== AUTH HELPERS ====================

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Credenciales inválidas",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        token = credentials.credentials
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    
    user = await db.users.find_one({"_id": ObjectId(user_id)})
    if user is None:
        raise credentials_exception
    return user

# ==================== ROLE PERMISSIONS ====================

# Roles that can view all agencies
ROLES_VIEW_ALL_AGENCIES = ["Director", "Gerente de Ventas Digitales", "Marketing", "Trafficker Digital", "Gerente General"]

# Roles that can view reports
ROLES_VIEW_REPORTS = ["Director", "Gerente de Ventas", "Gerente General", "Gerente de Ventas Digitales", "Marketing"]

# Roles that can manage users (CRUD)
ROLES_MANAGE_USERS = ["Gerente de Ventas Digitales"]

# Roles that can create leads
ROLES_CAN_CREATE_LEADS = ["DCA", "Trafficker Digital", "Gerente de Ventas Digitales"]

# Roles that can modify leads (general edits)
ROLES_CAN_MODIFY_LEADS = ["Gerente de Ventas Digitales"]

# Roles that can reassign DCA
ROLES_CAN_REASSIGN_DCA = ["Gerente de Ventas Digitales"]

# Roles that can reassign Asesor
ROLES_CAN_REASSIGN_ASESOR = ["DCA", "Gerente de Ventas Digitales"]

# Roles that can edit origin/campaign
ROLES_CAN_EDIT_ORIGIN_CAMPAIGN = ["DCA", "Trafficker Digital", "Gerente de Ventas Digitales"]

# Roles that can register sales
ROLES_CAN_REGISTER_SALES = ["Asesor Digital", "Gerente de Ventas Digitales"]

# Stage transition permissions by role
DCA_STAGES = ["Lead", "Contactado", "Citado", "Cumplida"]
ASESOR_STAGES = ["Cumplida", "Demo", "Cierre", "Facturada"]
ROLES_ALL_STAGES = ["Gerente de Ventas Digitales"]

# ==================== AUTH ROUTES ====================

@api_router.post("/auth/register", response_model=UserResponse)
async def register(user: UserCreate):
    existing = await db.users.find_one({"email": user.email})
    if existing:
        raise HTTPException(status_code=400, detail="El email ya está registrado")
    
    if user.role not in ROLES:
        raise HTTPException(status_code=400, detail=f"Rol inválido. Roles válidos: {ROLES}")
    
    if user.agency not in AGENCIES:
        raise HTTPException(status_code=400, detail=f"Agencia inválida. Agencias válidas: {AGENCIES}")
    
    hashed_password = get_password_hash(user.password)
    user_dict = {
        "email": user.email,
        "password": hashed_password,
        "name": user.name,
        "role": user.role,
        "agency": user.agency,
        "created_at": datetime.utcnow()
    }
    
    result = await db.users.insert_one(user_dict)
    user_dict["id"] = str(result.inserted_id)
    del user_dict["password"]
    return UserResponse(**user_dict)

@api_router.post("/auth/login", response_model=Token)
async def login(user_data: UserLogin):
    user = await db.users.find_one({"email": user_data.email})
    if not user or not verify_password(user_data.password, user["password"]):
        raise HTTPException(status_code=401, detail="Email o contraseña incorrectos")
    
    # Check if user is active
    if not user.get("active", True):
        raise HTTPException(status_code=401, detail="Usuario desactivado. Contacta al administrador.")
    
    access_token = create_access_token(data={"sub": str(user["_id"])})
    return {"access_token": access_token, "token_type": "bearer"}

@api_router.get("/auth/me", response_model=UserResponse)
async def get_me(current_user: dict = Depends(get_current_user)):
    return UserResponse(
        id=str(current_user["_id"]),
        email=current_user["email"],
        name=current_user["name"],
        role=current_user["role"],
        agency=current_user["agency"],
        agencies=current_user.get("agencies"),
        active=current_user.get("active", True),
        created_at=current_user["created_at"]
    )

# ==================== USER ROUTES ====================

@api_router.get("/users", response_model=List[UserResponse])
async def get_users(agency: Optional[str] = None, role: Optional[str] = None, include_inactive: bool = False, current_user: dict = Depends(get_current_user)):
    query = {}
    if agency:
        query["agency"] = agency
    if role:
        query["role"] = role
    if not include_inactive:
        query["$or"] = [{"active": True}, {"active": {"$exists": False}}]
    
    users = await db.users.find(query).sort("name", 1).to_list(1000)
    return [UserResponse(
        id=str(u["_id"]),
        email=u["email"],
        name=u["name"],
        role=u["role"],
        agency=u["agency"],
        agencies=u.get("agencies"),
        active=u.get("active", True),
        created_at=u["created_at"]
    ) for u in users]

@api_router.get("/users/all", response_model=List[UserResponse])
async def get_all_users(current_user: dict = Depends(get_current_user)):
    """Get all users including inactive - Director and Gerente de Ventas Digitales"""
    if current_user["role"] not in ["Director", "Gerente de Ventas Digitales"]:
        raise HTTPException(status_code=403, detail="No tienes permisos para ver todos los usuarios")
    
    users = await db.users.find().sort("name", 1).to_list(1000)
    return [UserResponse(
        id=str(u["_id"]),
        email=u["email"],
        name=u["name"],
        role=u["role"],
        agency=u["agency"],
        agencies=u.get("agencies"),
        active=u.get("active", True),
        created_at=u["created_at"]
    ) for u in users]

@api_router.post("/users", response_model=UserResponse)
async def create_user(user: UserCreate, current_user: dict = Depends(get_current_user)):
    """Create a new user - Gerente de Ventas Digitales only"""
    if current_user["role"] not in ROLES_MANAGE_USERS:
        raise HTTPException(status_code=403, detail="Solo el Gerente de Ventas Digitales puede crear usuarios")
    
    existing = await db.users.find_one({"email": user.email})
    if existing:
        raise HTTPException(status_code=400, detail="El email ya está registrado")
    
    if user.role not in ROLES:
        raise HTTPException(status_code=400, detail=f"Rol inválido. Roles válidos: {ROLES}")
    
    if user.agency not in AGENCIES:
        raise HTTPException(status_code=400, detail=f"Agencia inválida. Agencias válidas: {AGENCIES}")
    
    # Validate agencies list if provided
    agencies_list = user.agencies or [user.agency]
    for ag in agencies_list:
        if ag not in AGENCIES:
            raise HTTPException(status_code=400, detail=f"Agencia inválida: {ag}")
    
    hashed_password = get_password_hash(user.password)
    user_dict = {
        "email": user.email,
        "password": hashed_password,
        "name": user.name,
        "role": user.role,
        "agency": user.agency,
        "agencies": agencies_list,
        "active": True,
        "created_at": datetime.utcnow()
    }
    
    result = await db.users.insert_one(user_dict)
    user_dict["id"] = str(result.inserted_id)
    del user_dict["password"]
    return UserResponse(**user_dict)

@api_router.patch("/users/{user_id}", response_model=UserResponse)
async def update_user(user_id: str, user_update: UserUpdate, current_user: dict = Depends(get_current_user)):
    """Update a user - Gerente de Ventas Digitales only"""
    if current_user["role"] not in ROLES_MANAGE_USERS:
        raise HTTPException(status_code=403, detail="Solo el Gerente de Ventas Digitales puede editar usuarios")
    
    existing_user = await db.users.find_one({"_id": ObjectId(user_id)})
    if not existing_user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    update_data = {}
    
    if user_update.name:
        update_data["name"] = user_update.name
    
    if user_update.email:
        # Check if email is already taken by another user
        email_check = await db.users.find_one({"email": user_update.email, "_id": {"$ne": ObjectId(user_id)}})
        if email_check:
            raise HTTPException(status_code=400, detail="El email ya está en uso por otro usuario")
        update_data["email"] = user_update.email
    
    if user_update.password:
        update_data["password"] = get_password_hash(user_update.password)
    
    if user_update.role:
        if user_update.role not in ROLES:
            raise HTTPException(status_code=400, detail=f"Rol inválido")
        update_data["role"] = user_update.role
    
    if user_update.agency:
        if user_update.agency not in AGENCIES:
            raise HTTPException(status_code=400, detail=f"Agencia inválida")
        update_data["agency"] = user_update.agency
    
    if user_update.agencies is not None:
        for ag in user_update.agencies:
            if ag not in AGENCIES:
                raise HTTPException(status_code=400, detail=f"Agencia inválida: {ag}")
        update_data["agencies"] = user_update.agencies
    
    if user_update.active is not None:
        update_data["active"] = user_update.active
    
    if update_data:
        await db.users.update_one({"_id": ObjectId(user_id)}, {"$set": update_data})
    
    updated_user = await db.users.find_one({"_id": ObjectId(user_id)})
    return UserResponse(
        id=str(updated_user["_id"]),
        email=updated_user["email"],
        name=updated_user["name"],
        role=updated_user["role"],
        agency=updated_user["agency"],
        agencies=updated_user.get("agencies"),
        active=updated_user.get("active", True),
        created_at=updated_user["created_at"]
    )

@api_router.delete("/users/{user_id}")
async def deactivate_user(user_id: str, current_user: dict = Depends(get_current_user)):
    """Deactivate a user - Gerente de Ventas Digitales only"""
    if current_user["role"] not in ROLES_MANAGE_USERS:
        raise HTTPException(status_code=403, detail="Solo el Gerente de Ventas Digitales puede desactivar usuarios")
    
    # Can't deactivate yourself
    if str(current_user["_id"]) == user_id:
        raise HTTPException(status_code=400, detail="No puedes desactivarte a ti mismo")
    
    existing_user = await db.users.find_one({"_id": ObjectId(user_id)})
    if not existing_user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    await db.users.update_one({"_id": ObjectId(user_id)}, {"$set": {"active": False}})
    
    return {"message": "Usuario desactivado exitosamente"}

@api_router.delete("/users/{user_id}/permanent")
async def delete_user_permanent(user_id: str, current_user: dict = Depends(get_current_user)):
    """Permanently delete a user - Gerente de Ventas Digitales only"""
    if current_user["role"] not in ROLES_MANAGE_USERS:
        raise HTTPException(status_code=403, detail="Solo el Gerente de Ventas Digitales puede eliminar usuarios")
    
    # Can't delete yourself
    if str(current_user["_id"]) == user_id:
        raise HTTPException(status_code=400, detail="No puedes eliminarte a ti mismo")
    
    existing_user = await db.users.find_one({"_id": ObjectId(user_id)})
    if not existing_user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    await db.users.delete_one({"_id": ObjectId(user_id)})
    
    return {"message": "Usuario eliminado permanentemente"}

@api_router.get("/users/dcas", response_model=List[UserResponse])
async def get_dcas(agency: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    query = {"role": "DCA"}
    if agency:
        query["agency"] = agency
    
    users = await db.users.find(query).to_list(1000)
    return [UserResponse(
        id=str(u["_id"]),
        email=u["email"],
        name=u["name"],
        role=u["role"],
        agency=u["agency"],
        created_at=u["created_at"]
    ) for u in users]

@api_router.get("/users/asesores", response_model=List[UserResponse])
async def get_asesores(agency: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    query = {"role": "Asesor Digital"}
    if agency:
        query["agency"] = agency
    
    users = await db.users.find(query).to_list(1000)
    return [UserResponse(
        id=str(u["_id"]),
        email=u["email"],
        name=u["name"],
        role=u["role"],
        agency=u["agency"],
        created_at=u["created_at"]
    ) for u in users]

# ==================== LEAD ROUTES ====================

@api_router.post("/leads", response_model=LeadResponse)
async def create_lead(lead: LeadCreate, current_user: dict = Depends(get_current_user)):
    # Check if role can create leads
    if current_user["role"] not in ROLES_CAN_CREATE_LEADS:
        raise HTTPException(status_code=403, detail="No tienes permisos para crear leads")
    
    if lead.agency not in AGENCIES:
        raise HTTPException(status_code=400, detail=f"Agencia inválida")
    
    # Validate origin - allow both new and legacy values for backwards compatibility
    LEGACY_ORIGINS = ["Walk-in", "Llamada", "Otro", "Cita Previa"]
    ALL_VALID_ORIGINS = ORIGINS + LEGACY_ORIGINS
    if lead.origin not in ALL_VALID_ORIGINS:
        raise HTTPException(status_code=400, detail=f"Origen inválido. Opciones válidas: {', '.join(ORIGINS)}")
    
    # Get DCA name
    dca = await db.users.find_one({"_id": ObjectId(lead.dca_id)})
    if not dca:
        raise HTTPException(status_code=400, detail="DCA no encontrado")
    
    now = datetime.utcnow()
    lead_dict = {
        "name": lead.name,
        "phone": lead.phone,
        "agency": lead.agency,
        "origin": lead.origin,
        "campaign": lead.campaign or "",
        "campaign_id": lead.campaign_id,
        "stage": "Lead",
        "dca_id": lead.dca_id,
        "dca_name": dca["name"],
        "asesor_id": None,
        "asesor_name": None,
        "created_at": now,
        "created_by": str(current_user["_id"]),
        "created_by_name": current_user["name"],
        "updated_at": now,
        "stage_history": [{"stage": "Lead", "timestamp": now.isoformat(), "user": current_user["name"]}]
    }
    
    result = await db.leads.insert_one(lead_dict)
    lead_dict["id"] = str(result.inserted_id)
    return LeadResponse(**lead_dict)

@api_router.get("/leads", response_model=dict)
async def get_leads(
    agency: Optional[str] = None,
    stage: Optional[str] = None,
    dca_id: Optional[str] = None,
    search: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    page: int = 1,
    limit: int = 50,
    current_user: dict = Depends(get_current_user)
):
    query = {}
    
    user_role = current_user["role"]
    user_id = str(current_user["_id"])
    user_agencies = current_user.get("agencies", [current_user["agency"]])
    
    # ==================== ROLE-BASED VISIBILITY ====================
    
    # ASESOR DIGITAL: Solo puede ver leads asignados a él
    if user_role == "Asesor Digital":
        query["asesor_id"] = user_id
        # Agency filter is ignored for Asesor Digital - they only see their assigned leads
        if agency and agency not in user_agencies:
            raise HTTPException(status_code=403, detail="No tienes acceso a esta agencia")
    
    # DCA: Solo puede ver leads de su agencia
    elif user_role == "DCA":
        if agency:
            if agency not in user_agencies:
                raise HTTPException(status_code=403, detail="No tienes acceso a leads de esta agencia")
            query["agency"] = agency
        else:
            query["agency"] = {"$in": user_agencies}
    
    # GERENTE DE VENTAS: Solo puede ver leads de su agencia
    elif user_role == "Gerente de Ventas":
        if agency:
            if agency not in user_agencies:
                raise HTTPException(status_code=403, detail="No tienes acceso a leads de esta agencia")
            query["agency"] = agency
        else:
            query["agency"] = {"$in": user_agencies}
    
    # DIRECTOR, GERENTE DE VENTAS DIGITALES, MARKETING, TRAFFICKER DIGITAL, GERENTE GENERAL: Pueden ver todas las agencias
    elif user_role in ROLES_VIEW_ALL_AGENCIES:
        if agency:
            query["agency"] = agency
    
    # Any other role - restrict to their agencies
    else:
        if agency:
            if agency not in user_agencies:
                raise HTTPException(status_code=403, detail="No tienes acceso a leads de esta agencia")
            query["agency"] = agency
        else:
            query["agency"] = {"$in": user_agencies}
    
    if stage:
        query["stage"] = stage
    if dca_id:
        query["dca_id"] = dca_id
    
    # Search by name or phone
    if search:
        search_query = [
            {"name": {"$regex": search, "$options": "i"}},
            {"phone": {"$regex": search, "$options": "i"}}
        ]
        if "$or" in query:
            query["$and"] = [{"$or": query.pop("$or")}, {"$or": search_query}]
        else:
            query["$or"] = search_query
    
    if date_from:
        try:
            query["created_at"] = {"$gte": datetime.fromisoformat(date_from.replace('Z', '+00:00'))}
        except:
            query["created_at"] = {"$gte": datetime.fromisoformat(date_from)}
    if date_to:
        try:
            end_date = datetime.fromisoformat(date_to.replace('Z', '+00:00'))
        except:
            end_date = datetime.fromisoformat(date_to)
        if "created_at" in query:
            query["created_at"]["$lte"] = end_date
        else:
            query["created_at"] = {"$lte": end_date}
    
    # Count total
    total = await db.leads.count_documents(query)
    
    # Pagination
    skip = (page - 1) * limit
    leads = await db.leads.find(query).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    leads_data = [LeadResponse(
        id=str(l["_id"]),
        name=l["name"],
        phone=l["phone"],
        agency=l["agency"],
        origin=l["origin"],
        campaign=l.get("campaign", ""),
        campaign_id=l.get("campaign_id"),
        stage=l["stage"],
        dca_id=l["dca_id"],
        dca_name=l.get("dca_name"),
        asesor_id=l.get("asesor_id"),
        asesor_name=l.get("asesor_name"),
        created_at=l["created_at"],
        created_by=l["created_by"],
        created_by_name=l.get("created_by_name"),
        updated_at=l.get("updated_at"),
        stage_history=l.get("stage_history", []),
        notes=l.get("notes")
    ) for l in leads]
    
    return {
        "leads": [l.dict() for l in leads_data],
        "total": total,
        "page": page,
        "limit": limit,
        "total_pages": (total + limit - 1) // limit
    }

@api_router.get("/leads/{lead_id}", response_model=LeadResponse)
async def get_lead(lead_id: str, current_user: dict = Depends(get_current_user)):
    lead = await db.leads.find_one({"_id": ObjectId(lead_id)})
    if not lead:
        raise HTTPException(status_code=404, detail="Lead no encontrado")
    
    user_role = current_user["role"]
    user_id = str(current_user["_id"])
    user_agencies = current_user.get("agencies", [current_user["agency"]])
    
    # ASESOR DIGITAL: Solo puede ver leads asignados a él
    if user_role == "Asesor Digital":
        if lead.get("asesor_id") != user_id:
            raise HTTPException(status_code=403, detail="No tienes acceso a este lead")
    
    # DCA, GERENTE DE VENTAS: Solo puede ver leads de su agencia
    elif user_role in ["DCA", "Gerente de Ventas"]:
        if lead["agency"] not in user_agencies:
            raise HTTPException(status_code=403, detail="No tienes acceso a este lead")
    
    return LeadResponse(
        id=str(lead["_id"]),
        name=lead["name"],
        phone=lead["phone"],
        agency=lead["agency"],
        origin=lead["origin"],
        campaign=lead.get("campaign", ""),
        campaign_id=lead.get("campaign_id"),
        stage=lead["stage"],
        dca_id=lead["dca_id"],
        dca_name=lead.get("dca_name"),
        asesor_id=lead.get("asesor_id"),
        asesor_name=lead.get("asesor_name"),
        created_at=lead["created_at"],
        created_by=lead["created_by"],
        created_by_name=lead.get("created_by_name"),
        updated_at=lead.get("updated_at"),
        stage_history=lead.get("stage_history", []),
        notes=lead.get("notes")
    )

@api_router.patch("/leads/{lead_id}", response_model=LeadResponse)
async def update_lead(lead_id: str, lead_update: LeadUpdate, current_user: dict = Depends(get_current_user)):
    lead = await db.leads.find_one({"_id": ObjectId(lead_id)})
    if not lead:
        raise HTTPException(status_code=404, detail="Lead no encontrado")
    
    user_role = current_user["role"]
    user_id = str(current_user["_id"])
    user_agencies = current_user.get("agencies", [current_user["agency"]])
    current_stage = lead["stage"]
    new_stage = lead_update.stage
    
    # ==================== ACCESS VALIDATION ====================
    
    # ASESOR DIGITAL: Solo puede ver/editar leads asignados a él
    if user_role == "Asesor Digital":
        if lead.get("asesor_id") != user_id:
            raise HTTPException(status_code=403, detail="No tienes acceso a este lead")
    
    # DCA, GERENTE DE VENTAS: Solo puede ver leads de su agencia
    elif user_role in ["DCA", "Gerente de Ventas"]:
        if lead["agency"] not in user_agencies:
            raise HTTPException(status_code=403, detail="No tienes acceso a este lead")
    
    # ==================== ROLE-BASED RESTRICTIONS ====================
    
    # DIRECTOR: Solo supervisión, no puede modificar nada
    if user_role == "Director":
        raise HTTPException(status_code=403, detail="El Director solo tiene acceso de supervisión y no puede modificar leads")
    
    # MARKETING: No puede modificar leads
    if user_role == "Marketing":
        raise HTTPException(status_code=403, detail="Marketing no puede modificar leads")
    
    # GERENTE DE VENTAS: No puede modificar DCA ni Asesor
    if user_role == "Gerente de Ventas":
        if lead_update.dca_id or lead_update.asesor_id:
            raise HTTPException(status_code=403, detail="Gerente de Ventas no puede reasignar DCA ni Asesor")
    
    # TRAFFICKER DIGITAL: Solo puede editar origen y campaña, no puede mover etapas ni reasignar
    if user_role == "Trafficker Digital":
        if new_stage and new_stage != current_stage:
            raise HTTPException(status_code=403, detail="Trafficker Digital no puede cambiar etapas")
        if lead_update.dca_id or lead_update.asesor_id:
            raise HTTPException(status_code=403, detail="Trafficker Digital no puede reasignar usuarios")
        if lead_update.name or lead_update.phone:
            raise HTTPException(status_code=403, detail="Trafficker Digital solo puede editar origen y campaña")
    
    # ==================== FIELD-LEVEL PERMISSIONS ====================
    
    # Check DCA reassignment permissions
    if lead_update.dca_id and lead_update.dca_id != lead.get("dca_id"):
        if user_role not in ROLES_CAN_REASSIGN_DCA:
            raise HTTPException(status_code=403, detail="No tienes permisos para reasignar el DCA")
    
    # Check Asesor reassignment permissions
    if lead_update.asesor_id and lead_update.asesor_id != lead.get("asesor_id"):
        if user_role not in ROLES_CAN_REASSIGN_ASESOR:
            raise HTTPException(status_code=403, detail="No tienes permisos para reasignar el Asesor")
    
    # Check origin/campaign edit permissions
    if (lead_update.origin and lead_update.origin != lead.get("origin")) or \
       (lead_update.campaign is not None and lead_update.campaign != lead.get("campaign", "")):
        if user_role not in ROLES_CAN_EDIT_ORIGIN_CAMPAIGN:
            raise HTTPException(status_code=403, detail="No tienes permisos para editar origen o campaña")
    
    # ASESOR DIGITAL specific restrictions
    if user_role == "Asesor Digital":
        # Cannot change DCA
        if lead_update.dca_id:
            raise HTTPException(status_code=403, detail="Asesor Digital no puede cambiar el DCA")
        # Cannot reassign asesor
        if lead_update.asesor_id and lead_update.asesor_id != user_id:
            raise HTTPException(status_code=403, detail="Asesor Digital no puede reasignar a otro asesor")
        # Cannot edit origin or campaign
        if lead_update.origin or lead_update.campaign is not None:
            raise HTTPException(status_code=403, detail="Asesor Digital no puede modificar origen ni campaña")
    
    # ==================== STAGE TRANSITION PERMISSIONS ====================
    
    if new_stage and new_stage != current_stage:
        if new_stage not in FUNNEL_STAGES:
            raise HTTPException(status_code=400, detail="Etapa inválida")
        
        # GERENTE DE VENTAS DIGITALES: Can move to any stage
        if user_role in ROLES_ALL_STAGES:
            pass  # Allowed to move to any stage
        
        # DCA: Can only move within Lead -> Contactado -> Citado -> Cumplida
        elif user_role == "DCA":
            if new_stage not in DCA_STAGES:
                raise HTTPException(status_code=403, detail="DCA solo puede mover leads entre: Lead, Contactado, Citado y Cumplida")
            if current_stage not in DCA_STAGES:
                raise HTTPException(status_code=403, detail="DCA no puede modificar leads que ya pasaron de Cumplida")
        
        # ASESOR DIGITAL: Can only move within Cumplida -> Demo -> Cierre -> Facturada
        elif user_role == "Asesor Digital":
            if new_stage not in ASESOR_STAGES:
                raise HTTPException(status_code=403, detail="Asesor Digital solo puede mover leads entre: Cumplida, Demo, Cierre y Facturada")
            if current_stage not in ASESOR_STAGES:
                raise HTTPException(status_code=403, detail="El lead debe estar en Cumplida o posterior para que un Asesor lo mueva")
        
        # GERENTE DE VENTAS: Cannot change stages
        elif user_role == "Gerente de Ventas":
            raise HTTPException(status_code=403, detail="Gerente de Ventas no puede cambiar etapas de leads")
        
        # Other roles that cannot change stages
        else:
            raise HTTPException(status_code=403, detail="No tienes permisos para cambiar etapas")
    
    # Check asesor assignment validation (agency match)
    if lead_update.asesor_id:
        asesor = await db.users.find_one({"_id": ObjectId(lead_update.asesor_id)})
        if not asesor:
            raise HTTPException(status_code=400, detail="Asesor no encontrado")
        
        # Use new agency if being changed, otherwise use current lead agency
        check_agency = lead_update.agency if lead_update.agency else lead["agency"]
        asesor_agencies = asesor.get("agencies", [asesor["agency"]])
        if check_agency not in asesor_agencies:
            raise HTTPException(status_code=400, detail="El asesor debe pertenecer a la misma agencia del lead")
    
    # Check agency change permission (only Gerente de Ventas Digitales)
    if lead_update.agency and lead_update.agency != lead["agency"]:
        if user_role != "Gerente de Ventas Digitales":
            raise HTTPException(status_code=403, detail="Solo el Gerente de Ventas Digitales puede cambiar la agencia")
        if lead_update.agency not in AGENCIES:
            raise HTTPException(status_code=400, detail="Agencia inválida")
    
    # ==================== PERFORM UPDATE ====================
    
    update_data = {}
    changes_made = []
    
    if lead_update.name and lead_update.name != lead.get("name"):
        update_data["name"] = lead_update.name
        changes_made.append("nombre")
    if lead_update.phone and lead_update.phone != lead.get("phone"):
        update_data["phone"] = lead_update.phone
        changes_made.append("teléfono")
    if lead_update.origin and lead_update.origin != lead.get("origin"):
        update_data["origin"] = lead_update.origin
        changes_made.append("origen")
    if lead_update.campaign is not None and lead_update.campaign != lead.get("campaign", ""):
        update_data["campaign"] = lead_update.campaign
        changes_made.append("campaña")
    if lead_update.agency and lead_update.agency != lead.get("agency"):
        update_data["agency"] = lead_update.agency
        changes_made.append("agencia")
    if lead_update.notes is not None and lead_update.notes != lead.get("notes", ""):
        update_data["notes"] = lead_update.notes
        changes_made.append("notas")
    if lead_update.dca_id and lead_update.dca_id != lead.get("dca_id"):
        dca = await db.users.find_one({"_id": ObjectId(lead_update.dca_id)})
        if dca:
            update_data["dca_id"] = lead_update.dca_id
            update_data["dca_name"] = dca["name"]
            changes_made.append("DCA")
    if lead_update.asesor_id and lead_update.asesor_id != lead.get("asesor_id"):
        asesor = await db.users.find_one({"_id": ObjectId(lead_update.asesor_id)})
        if asesor:
            update_data["asesor_id"] = lead_update.asesor_id
            update_data["asesor_name"] = asesor["name"]
            changes_made.append("Asesor")
    
    # Handle stage change
    if new_stage and new_stage != current_stage:
        update_data["stage"] = new_stage
        stage_history = lead.get("stage_history", [])
        stage_history.append({
            "stage": new_stage,
            "timestamp": datetime.utcnow().isoformat(),
            "user": current_user["name"]
        })
        update_data["stage_history"] = stage_history
    # Add edit history entry if non-stage changes were made
    elif changes_made:
        stage_history = lead.get("stage_history", [])
        stage_history.append({
            "stage": f"Editado: {', '.join(changes_made)}",
            "timestamp": datetime.utcnow().isoformat(),
            "user": current_user["name"]
        })
        update_data["stage_history"] = stage_history
    
    update_data["updated_at"] = datetime.utcnow()
    
    await db.leads.update_one({"_id": ObjectId(lead_id)}, {"$set": update_data})
    
    updated_lead = await db.leads.find_one({"_id": ObjectId(lead_id)})
    return LeadResponse(
        id=str(updated_lead["_id"]),
        name=updated_lead["name"],
        phone=updated_lead["phone"],
        agency=updated_lead["agency"],
        origin=updated_lead["origin"],
        campaign=updated_lead.get("campaign", ""),
        campaign_id=updated_lead.get("campaign_id"),
        stage=updated_lead["stage"],
        dca_id=updated_lead["dca_id"],
        dca_name=updated_lead.get("dca_name"),
        asesor_id=updated_lead.get("asesor_id"),
        asesor_name=updated_lead.get("asesor_name"),
        created_at=updated_lead["created_at"],
        created_by=updated_lead["created_by"],
        created_by_name=updated_lead.get("created_by_name"),
        updated_at=updated_lead.get("updated_at"),
        stage_history=updated_lead.get("stage_history", []),
        notes=updated_lead.get("notes")
    )

# Roles that can delete leads
ROLES_CAN_DELETE_LEADS = ["Gerente de Ventas Digitales"]

@api_router.delete("/leads/{lead_id}")
async def delete_lead(lead_id: str, current_user: dict = Depends(get_current_user)):
    """Delete a lead - Gerente de Ventas Digitales only"""
    if current_user["role"] not in ROLES_CAN_DELETE_LEADS:
        raise HTTPException(status_code=403, detail="Solo el Gerente de Ventas Digitales puede eliminar leads")
    
    lead = await db.leads.find_one({"_id": ObjectId(lead_id)})
    if not lead:
        raise HTTPException(status_code=404, detail="Lead no encontrado")
    
    # Delete the lead
    await db.leads.delete_one({"_id": ObjectId(lead_id)})
    
    # Also delete any associated sales
    await db.sales.delete_many({"lead_id": lead_id})
    
    return {"message": "Lead eliminado correctamente", "id": lead_id}

# ==================== SALES ROUTES ====================

@api_router.post("/sales", response_model=SaleResponse)
async def create_sale(sale: SaleCreate, current_user: dict = Depends(get_current_user)):
    # Check if role can register sales
    if current_user["role"] not in ROLES_CAN_REGISTER_SALES:
        raise HTTPException(status_code=403, detail="No tienes permisos para registrar ventas")
    
    # Verify lead exists
    lead = await db.leads.find_one({"_id": ObjectId(sale.lead_id)})
    if not lead:
        raise HTTPException(status_code=404, detail="Lead no encontrado")
    
    # For Asesor Digital, verify they are assigned to this lead
    if current_user["role"] == "Asesor Digital":
        if lead.get("asesor_id") != str(current_user["_id"]):
            raise HTTPException(status_code=403, detail="Solo puedes registrar ventas de leads asignados a ti")
    
    # Get asesor and DCA info
    asesor = await db.users.find_one({"_id": ObjectId(sale.asesor_id)})
    dca = await db.users.find_one({"_id": ObjectId(sale.dca_id)})
    
    if not asesor or not dca:
        raise HTTPException(status_code=400, detail="Asesor o DCA no encontrado")
    
    # Calculate time to sale (handle timezone-aware dates)
    lead_created = lead["created_at"]
    fecha_factura = sale.fecha_factura
    
    # Make both dates timezone-naive for comparison
    if hasattr(lead_created, 'tzinfo') and lead_created.tzinfo is not None:
        lead_created = lead_created.replace(tzinfo=None)
    if hasattr(fecha_factura, 'tzinfo') and fecha_factura.tzinfo is not None:
        fecha_factura = fecha_factura.replace(tzinfo=None)
    
    time_to_sale = (fecha_factura - lead_created).days
    
    # Calculate total amount
    monto_total = sale.precio * sale.cantidad
    
    sale_dict = {
        "lead_id": sale.lead_id,
        "lead_name": lead["name"],
        "lead_phone": lead["phone"],
        "marca": sale.marca,
        "modelo": sale.modelo,
        "version": sale.version,
        "precio": sale.precio,
        "cantidad": sale.cantidad,
        "monto_total": monto_total,
        "tipo_venta": sale.tipo_venta,
        "asesor_id": sale.asesor_id,
        "asesor_name": asesor["name"],
        "dca_id": sale.dca_id,
        "dca_name": dca["name"],
        "agency": lead["agency"],
        "origen": sale.origen,
        "campaign": sale.campaign,
        "facturado_a": sale.facturado_a,
        "fecha_factura": sale.fecha_factura,
        "created_at": datetime.utcnow(),
        "lead_created_at": lead["created_at"],
        "time_to_sale_days": time_to_sale
    }
    
    result = await db.sales.insert_one(sale_dict)
    
    # Update lead to Facturada stage with all necessary info
    stage_history = lead.get("stage_history", [])
    stage_history.append({
        "stage": "Facturada",
        "timestamp": datetime.utcnow().isoformat(),
        "user": current_user["name"]
    })
    
    await db.leads.update_one(
        {"_id": ObjectId(sale.lead_id)},
        {"$set": {
            "stage": "Facturada",
            "updated_at": datetime.utcnow(),
            "asesor_id": sale.asesor_id,
            "asesor_name": asesor["name"],
            "sale_id": str(result.inserted_id),
            "stage_history": stage_history
        }}
    )
    
    sale_dict["id"] = str(result.inserted_id)
    return SaleResponse(**sale_dict)

@api_router.get("/sales", response_model=List[SaleResponse])
async def get_sales(
    agency: Optional[str] = None,
    dca_id: Optional[str] = None,
    asesor_id: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    query = {}
    if agency:
        query["agency"] = agency
    if dca_id:
        query["dca_id"] = dca_id
    if asesor_id:
        query["asesor_id"] = asesor_id
    
    if date_from:
        try:
            query["fecha_factura"] = {"$gte": datetime.fromisoformat(date_from.replace('Z', '+00:00'))}
        except:
            query["fecha_factura"] = {"$gte": datetime.fromisoformat(date_from)}
    if date_to:
        try:
            end_date = datetime.fromisoformat(date_to.replace('Z', '+00:00'))
        except:
            end_date = datetime.fromisoformat(date_to)
        if "fecha_factura" in query:
            query["fecha_factura"]["$lte"] = end_date
        else:
            query["fecha_factura"] = {"$lte": end_date}
    
    sales = await db.sales.find(query).sort("fecha_factura", -1).to_list(1000)
    return [SaleResponse(
        id=str(s["_id"]),
        lead_id=s["lead_id"],
        lead_name=s["lead_name"],
        lead_phone=s.get("lead_phone"),
        marca=s["marca"],
        modelo=s["modelo"],
        version=s["version"],
        precio=s["precio"],
        cantidad=s.get("cantidad", 1),
        monto_total=s.get("monto_total", s["precio"]),
        tipo_venta=s["tipo_venta"],
        asesor_id=s["asesor_id"],
        asesor_name=s["asesor_name"],
        dca_id=s["dca_id"],
        dca_name=s["dca_name"],
        agency=s["agency"],
        origen=s["origen"],
        campaign=s["campaign"],
        facturado_a=s["facturado_a"],
        fecha_factura=s["fecha_factura"],
        created_at=s["created_at"],
        lead_created_at=s.get("lead_created_at"),
        time_to_sale_days=s.get("time_to_sale_days")
    ) for s in sales]

# ==================== METRICS & DASHBOARD ====================

@api_router.get("/metrics/dashboard")
async def get_dashboard_metrics(
    filter_type: str = "month",  # today, week, month
    current_user: dict = Depends(get_current_user)
):
    user_role = current_user["role"]
    user_agencies = current_user.get("agencies", [current_user["agency"]])
    
    # Asesor Digital cannot see the general dashboard
    if user_role == "Asesor Digital":
        raise HTTPException(status_code=403, detail="Asesor Digital no tiene acceso al dashboard general")
    
    now = datetime.utcnow()
    
    # Calculate date range
    if filter_type == "today":
        start_date = now.replace(hour=0, minute=0, second=0, microsecond=0)
    elif filter_type == "week":
        start_date = now - timedelta(days=now.weekday())
        start_date = start_date.replace(hour=0, minute=0, second=0, microsecond=0)
    else:  # month
        start_date = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    
    # Determine which agencies to show based on role
    if user_role in ROLES_VIEW_ALL_AGENCIES:
        agencies_to_show = AGENCIES
    else:
        # DCA, Gerente de Ventas - only their agencies
        agencies_to_show = user_agencies
    
    agencies_data = []
    
    for agency in AGENCIES:
        # Skip agencies user doesn't have access to
        if agency not in agencies_to_show:
            continue
            
        agency_metrics = {"agency": agency, "stages": {}}
        
        # Get leads count by stage
        for stage in FUNNEL_STAGES:
            count = await db.leads.count_documents({
                "agency": agency,
                "stage": stage,
                "created_at": {"$gte": start_date}
            })
            agency_metrics["stages"][stage] = count
        
        # Total leads
        total_leads = await db.leads.count_documents({
            "agency": agency,
            "created_at": {"$gte": start_date}
        })
        agency_metrics["total_leads"] = total_leads
        
        # Calculate conversion rates and health
        if total_leads > 0:
            agency_metrics["conversion_rates"] = {}
            agency_metrics["health"] = {}
            
            for stage in ["Contactado", "Citado", "Cumplida", "Cierre"]:
                # Count leads that reached this stage or beyond
                stage_idx = FUNNEL_STAGES.index(stage)
                count_at_or_beyond = 0
                for s in FUNNEL_STAGES[stage_idx:]:
                    count_at_or_beyond += agency_metrics["stages"].get(s, 0)
                
                rate = (count_at_or_beyond / total_leads) * 100
                agency_metrics["conversion_rates"][stage] = round(rate, 1)
                
                # Health status
                threshold = HEALTH_THRESHOLDS.get(stage, 50)
                if rate >= threshold:
                    agency_metrics["health"][stage] = "green"
                elif rate >= threshold * 0.7:
                    agency_metrics["health"][stage] = "yellow"
                else:
                    agency_metrics["health"][stage] = "red"
        else:
            agency_metrics["conversion_rates"] = {s: 0 for s in ["Contactado", "Citado", "Cumplida", "Cierre"]}
            agency_metrics["health"] = {s: "green" for s in ["Contactado", "Citado", "Cumplida", "Cierre"]}
        
        agencies_data.append(agency_metrics)
    
    return {
        "filter_type": filter_type,
        "start_date": start_date.isoformat(),
        "agencies": agencies_data
    }

@api_router.get("/metrics/agency/{agency}")
async def get_agency_metrics(
    agency: str,
    filter_type: str = "month",
    current_user: dict = Depends(get_current_user)
):
    if agency not in AGENCIES:
        raise HTTPException(status_code=400, detail="Agencia inválida")
    
    user_role = current_user["role"]
    user_agencies = current_user.get("agencies", [current_user["agency"]])
    
    # Asesor Digital cannot see agency metrics
    if user_role == "Asesor Digital":
        raise HTTPException(status_code=403, detail="Asesor Digital no tiene acceso a métricas de agencia")
    
    # Check if user has access to this agency
    if user_role not in ROLES_VIEW_ALL_AGENCIES:
        if agency not in user_agencies:
            raise HTTPException(status_code=403, detail="No tienes acceso a las métricas de esta agencia")
    
    now = datetime.utcnow()
    
    if filter_type == "today":
        start_date = now.replace(hour=0, minute=0, second=0, microsecond=0)
    elif filter_type == "week":
        start_date = now - timedelta(days=now.weekday())
        start_date = start_date.replace(hour=0, minute=0, second=0, microsecond=0)
    else:
        start_date = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    
    # Get DCAs for this agency
    dcas = await db.users.find({"agency": agency, "role": "DCA"}).to_list(100)
    
    dca_metrics = []
    for dca in dcas:
        dca_id = str(dca["_id"])
        dca_data = {
            "id": dca_id,
            "name": dca["name"],
            "stages": {}
        }
        
        # Get leads by stage for this DCA
        for stage in FUNNEL_STAGES:
            count = await db.leads.count_documents({
                "dca_id": dca_id,
                "stage": stage,
                "created_at": {"$gte": start_date}
            })
            dca_data["stages"][stage] = count
        
        total = sum(dca_data["stages"].values())
        dca_data["total_leads"] = total
        
        # Calculate conversion rates
        if total > 0:
            dca_data["conversion_rates"] = {}
            for stage in ["Contactado", "Citado", "Cumplida", "Cierre"]:
                stage_idx = FUNNEL_STAGES.index(stage)
                count_at_or_beyond = sum(dca_data["stages"].get(s, 0) for s in FUNNEL_STAGES[stage_idx:])
                dca_data["conversion_rates"][stage] = round((count_at_or_beyond / total) * 100, 1)
        else:
            dca_data["conversion_rates"] = {s: 0 for s in ["Contactado", "Citado", "Cumplida", "Cierre"]}
        
        dca_metrics.append(dca_data)
    
    # Get recent sales
    recent_sales = await db.sales.find({
        "agency": agency,
        "fecha_factura": {"$gte": start_date}
    }).sort("fecha_factura", -1).limit(10).to_list(10)
    
    # Average time to sale
    sales_with_time = await db.sales.find({
        "agency": agency,
        "time_to_sale_days": {"$exists": True}
    }).to_list(1000)
    
    avg_time_to_sale = 0
    if sales_with_time:
        avg_time_to_sale = sum(s.get("time_to_sale_days", 0) for s in sales_with_time) / len(sales_with_time)
    
    return {
        "agency": agency,
        "filter_type": filter_type,
        "dca_metrics": dca_metrics,
        "recent_sales": [{
            "id": str(s["_id"]),
            "lead_name": s["lead_name"],
            "marca": s["marca"],
            "modelo": s["modelo"],
            "precio": s["precio"],
            "fecha_factura": s["fecha_factura"].isoformat()
        } for s in recent_sales],
        "avg_time_to_sale_days": round(avg_time_to_sale, 1)
    }

@api_router.get("/metrics/dca/{dca_id}")
async def get_dca_metrics(
    dca_id: str,
    filter_type: str = "month",
    current_user: dict = Depends(get_current_user)
):
    dca = await db.users.find_one({"_id": ObjectId(dca_id)})
    if not dca:
        raise HTTPException(status_code=404, detail="DCA no encontrado")
    
    now = datetime.utcnow()
    
    if filter_type == "today":
        start_date = now.replace(hour=0, minute=0, second=0, microsecond=0)
    elif filter_type == "week":
        start_date = now - timedelta(days=now.weekday())
        start_date = start_date.replace(hour=0, minute=0, second=0, microsecond=0)
    else:
        start_date = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    
    # Get today's start for pending leads
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    
    # Leads by stage
    stages = {}
    for stage in FUNNEL_STAGES:
        count = await db.leads.count_documents({
            "dca_id": dca_id,
            "stage": stage,
            "created_at": {"$gte": start_date}
        })
        stages[stage] = count
    
    total_leads = sum(stages.values())
    
    # New leads today
    new_leads_today = await db.leads.count_documents({
        "dca_id": dca_id,
        "created_at": {"$gte": today_start}
    })
    
    # Pending leads (not contacted yet)
    pending_leads = await db.leads.count_documents({
        "dca_id": dca_id,
        "stage": "Lead"
    })
    
    # Today's appointments (Citado stage)
    todays_appointments = await db.leads.find({
        "dca_id": dca_id,
        "stage": {"$in": ["Citado", "Cumplida"]}
    }).to_list(100)
    
    # Conversion rates
    conversion_rates = {}
    if total_leads > 0:
        for stage in ["Contactado", "Citado", "Cumplida", "Cierre"]:
            stage_idx = FUNNEL_STAGES.index(stage)
            count_at_or_beyond = sum(stages.get(s, 0) for s in FUNNEL_STAGES[stage_idx:])
            conversion_rates[stage] = round((count_at_or_beyond / total_leads) * 100, 1)
    else:
        conversion_rates = {s: 0 for s in ["Contactado", "Citado", "Cumplida", "Cierre"]}
    
    return {
        "dca_id": dca_id,
        "dca_name": dca["name"],
        "agency": dca["agency"],
        "filter_type": filter_type,
        "stages": stages,
        "total_leads": total_leads,
        "new_leads_today": new_leads_today,
        "pending_leads": pending_leads,
        "todays_appointments": len(todays_appointments),
        "conversion_rates": conversion_rates
    }

@api_router.get("/reports/overview")
async def get_reports_overview(
    filter_type: str = "month",
    start_date_param: Optional[str] = None,
    end_date_param: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    # Check if role can view reports
    if current_user["role"] not in ROLES_VIEW_REPORTS:
        raise HTTPException(status_code=403, detail="No tienes permisos para ver reportes")
    
    user_role = current_user["role"]
    user_agencies = current_user.get("agencies", [current_user["agency"]])
    
    now = datetime.utcnow()
    
    # If custom date range provided, use it
    if start_date_param and end_date_param:
        try:
            start_date = datetime.fromisoformat(start_date_param.replace('Z', '+00:00').replace('+00:00', ''))
            end_date = datetime.fromisoformat(end_date_param.replace('Z', '+00:00').replace('+00:00', ''))
            end_date = end_date.replace(hour=23, minute=59, second=59, microsecond=999999)
            date_filter = {"$gte": start_date, "$lte": end_date}
        except:
            # Fallback to filter_type
            if filter_type == "today":
                start_date = now.replace(hour=0, minute=0, second=0, microsecond=0)
            elif filter_type == "week":
                start_date = now - timedelta(days=now.weekday())
                start_date = start_date.replace(hour=0, minute=0, second=0, microsecond=0)
            else:
                start_date = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
            date_filter = {"$gte": start_date}
    else:
        if filter_type == "today":
            start_date = now.replace(hour=0, minute=0, second=0, microsecond=0)
        elif filter_type == "week":
            start_date = now - timedelta(days=now.weekday())
            start_date = start_date.replace(hour=0, minute=0, second=0, microsecond=0)
        else:
            start_date = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        date_filter = {"$gte": start_date}
    
    # Determine which agencies to show based on role
    # GERENTE DE VENTAS: Solo puede ver información de su agencia
    if user_role == "Gerente de Ventas":
        agencies_to_show = user_agencies
    else:
        # Director, Gerente de Ventas Digitales, Marketing, Gerente General can see all
        agencies_to_show = AGENCIES
    
    # By Agency - with detailed sales
    by_agency = []
    for agency in AGENCIES:
        # Skip agencies user doesn't have access to
        if agency not in agencies_to_show:
            continue
            
        total = await db.leads.count_documents({"agency": agency, "created_at": date_filter})
        facturadas = await db.leads.count_documents({"agency": agency, "stage": "Facturada", "created_at": date_filter})
        
        # Get all sales for this agency
        agency_sales = await db.sales.find({
            "agency": agency,
            "fecha_factura": date_filter
        }).sort("fecha_factura", -1).to_list(100)
        
        # Calculate totals
        monto_total = sum(s.get("monto_total", s["precio"]) for s in agency_sales)
        unidades_total = sum(s.get("cantidad", 1) for s in agency_sales)
        
        # Format sales detail
        sales_detail = []
        for s in agency_sales:
            fecha = s["fecha_factura"]
            if hasattr(fecha, 'isoformat'):
                fecha_str = fecha.isoformat()
            else:
                fecha_str = str(fecha)
            
            sales_detail.append({
                "id": str(s["_id"]),
                "lead_name": s["lead_name"],
                "lead_phone": s.get("lead_phone", ""),
                "facturado_a": s["facturado_a"],
                "marca": s["marca"],
                "modelo": s["modelo"],
                "version": s["version"],
                "cantidad": s.get("cantidad", 1),
                "precio": s["precio"],
                "monto_total": s.get("monto_total", s["precio"]),
                "tipo_venta": s["tipo_venta"],
                "asesor_name": s["asesor_name"],
                "dca_name": s["dca_name"],
                "origen": s["origen"],
                "campaign": s.get("campaign", ""),
                "fecha_factura": fecha_str
            })
        
        by_agency.append({
            "agency": agency,
            "total_leads": total,
            "facturadas": facturadas,
            "monto_total": monto_total,
            "unidades_total": unidades_total,
            "sales_count": len(agency_sales),
            "sales_detail": sales_detail
        })
    
    # By Origin - filtered by agencies_to_show for Gerente de Ventas
    origin_match = {"created_at": date_filter}
    if user_role == "Gerente de Ventas":
        origin_match["agency"] = {"$in": agencies_to_show}
    
    origins_pipeline = [
        {"$match": origin_match},
        {"$group": {"_id": "$origin", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}}
    ]
    by_origin = await db.leads.aggregate(origins_pipeline).to_list(20)
    
    # By Campaign - filtered by agencies_to_show for Gerente de Ventas
    campaign_match = {"created_at": date_filter, "campaign": {"$ne": ""}}
    if user_role == "Gerente de Ventas":
        campaign_match["agency"] = {"$in": agencies_to_show}
    
    campaigns_pipeline = [
        {"$match": campaign_match},
        {"$group": {"_id": "$campaign", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}}
    ]
    by_campaign = await db.leads.aggregate(campaigns_pipeline).to_list(20)
    
    # Top DCAs - filtered by agencies_to_show for Gerente de Ventas
    dca_match = {"created_at": date_filter}
    if user_role == "Gerente de Ventas":
        dca_match["agency"] = {"$in": agencies_to_show}
    
    dca_pipeline = [
        {"$match": dca_match},
        {"$group": {"_id": {"dca_id": "$dca_id", "dca_name": "$dca_name"}, "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": 10}
    ]
    top_dcas = await db.leads.aggregate(dca_pipeline).to_list(10)
    
    # Global totals
    global_totals = {
        "total_leads": sum(a["total_leads"] for a in by_agency),
        "total_facturadas": sum(a["facturadas"] for a in by_agency),
        "monto_total": sum(a["monto_total"] for a in by_agency),
        "unidades_total": sum(a["unidades_total"] for a in by_agency)
    }
    
    return {
        "filter_type": filter_type,
        "global_totals": global_totals,
        "by_agency": by_agency,
        "by_origin": [{"origin": o["_id"], "count": o["count"]} for o in by_origin],
        "by_campaign": [{"campaign": c["_id"], "count": c["count"]} for c in by_campaign],
        "top_dcas": [{"dca_id": d["_id"]["dca_id"], "dca_name": d["_id"]["dca_name"], "count": d["count"]} for d in top_dcas]
    }

# ==================== SEED DATA ====================

@api_router.post("/seed")
async def seed_data():
    """Create production users - only runs if no users exist"""
    
    # Check if already seeded
    existing = await db.users.count_documents({})
    if existing > 0:
        return {"message": "Usuarios ya existentes", "users_count": existing}
    
    # Create production users
    production_users = [
        {
            "email": "director@dcapp.com",
            "password": get_password_hash("dcapp123"),
            "name": "Director General",
            "role": "Director",
            "agency": "Meridien",
            "agencies": ["Meridien", "Jetour", "Cadillac"],
            "created_at": datetime.utcnow()
        },
        {
            "email": "dca.meridien@dcapp.com",
            "password": get_password_hash("dcapp123"),
            "name": "DCA Meridien",
            "role": "DCA",
            "agency": "Meridien",
            "agencies": ["Meridien"],
            "created_at": datetime.utcnow()
        },
        {
            "email": "dca.cadillac@dcapp.com",
            "password": get_password_hash("dcapp123"),
            "name": "DCA Cadillac Jetour",
            "role": "DCA",
            "agency": "Cadillac",
            "agencies": ["Cadillac", "Jetour"],
            "created_at": datetime.utcnow()
        }
    ]
    
    result = await db.users.insert_many(production_users)
    
    return {
        "message": "Usuarios de producción creados exitosamente",
        "users_created": len(production_users)
    }

@api_router.post("/admin/reset-database")
async def reset_database(current_user: dict = Depends(get_current_user)):
    """Clean all data and recreate production users - Director only"""
    
    if current_user["role"] != "Director":
        raise HTTPException(status_code=403, detail="Solo el Director puede reiniciar la base de datos")
    
    # Drop all collections
    await db.leads.delete_many({})
    await db.sales.delete_many({})
    await db.users.delete_many({})
    
    # Recreate production users
    production_users = [
        {
            "email": "director@dcapp.com",
            "password": get_password_hash("dcapp123"),
            "name": "Director General",
            "role": "Director",
            "agency": "Meridien",
            "agencies": ["Meridien", "Jetour", "Cadillac"],
            "created_at": datetime.utcnow()
        },
        {
            "email": "dca.meridien@dcapp.com",
            "password": get_password_hash("dcapp123"),
            "name": "DCA Meridien",
            "role": "DCA",
            "agency": "Meridien",
            "agencies": ["Meridien"],
            "created_at": datetime.utcnow()
        },
        {
            "email": "dca.cadillac@dcapp.com",
            "password": get_password_hash("dcapp123"),
            "name": "DCA Cadillac Jetour",
            "role": "DCA",
            "agency": "Cadillac",
            "agencies": ["Cadillac", "Jetour"],
            "created_at": datetime.utcnow()
        }
    ]
    
    await db.users.insert_many(production_users)
    
    return {
        "message": "Base de datos reiniciada exitosamente",
        "users_created": len(production_users),
        "leads_deleted": True,
        "sales_deleted": True
    }

# ==================== CAMPAIGN ROUTES ====================

async def calculate_campaign_metrics(campaign: dict) -> dict:
    """Calculate automatic metrics for a campaign including ROI"""
    campaign_id = str(campaign["_id"])
    presupuesto = campaign.get("presupuesto", 0) or 0
    
    # Calculate active days
    dias_activos = 0
    now = datetime.utcnow()
    
    fecha_activacion = campaign.get("fecha_activacion")
    fecha_finalizacion = campaign.get("fecha_finalizacion")
    
    # Handle timezone-aware datetimes
    if fecha_activacion:
        if fecha_activacion.tzinfo is not None:
            fecha_activacion = fecha_activacion.replace(tzinfo=None)
    if fecha_finalizacion:
        if fecha_finalizacion.tzinfo is not None:
            fecha_finalizacion = fecha_finalizacion.replace(tzinfo=None)
    
    if fecha_activacion and fecha_finalizacion:
        delta = fecha_finalizacion - fecha_activacion
        dias_activos = max(delta.days, 1)  # Minimum 1 day
    elif fecha_activacion and campaign.get("estado") == "Activa":
        delta = now - fecha_activacion
        dias_activos = max(delta.days, 1)
    
    # Count leads generated by this campaign
    leads_generados = await db.leads.count_documents({"campaign_id": campaign_id})
    
    # Calculate leads per active day
    leads_por_dia = 0.0
    if dias_activos > 0:
        leads_por_dia = round(leads_generados / dias_activos, 2)
    
    # Count sales attributed to this campaign (leads that reached Facturada)
    ventas_atribuidas = await db.leads.count_documents({
        "campaign_id": campaign_id,
        "stage": "Facturada"
    })
    
    # Calculate revenue from sales
    # Get all sales linked to leads of this campaign
    facturadas_leads = await db.leads.find({
        "campaign_id": campaign_id,
        "stage": "Facturada"
    }).to_list(1000)
    
    facturadas_ids = [l["_id"] for l in facturadas_leads]
    facturadas_str_ids = [str(lid) for lid in facturadas_ids]
    
    monto_vendido = 0.0
    if facturadas_str_ids:
        sales = await db.sales.find({"lead_id": {"$in": facturadas_str_ids}}).to_list(1000)
        for sale in sales:
            precio = sale.get("precio") or sale.get("price") or 0
            cantidad = sale.get("cantidad") or sale.get("quantity") or 1
            monto_vendido += precio * cantidad
    
    # Calculate cost metrics
    costo_por_lead = 0.0
    costo_por_venta = 0.0
    roi = 0.0
    
    if leads_generados > 0 and presupuesto > 0:
        costo_por_lead = round(presupuesto / leads_generados, 2)
    
    if ventas_atribuidas > 0 and presupuesto > 0:
        costo_por_venta = round(presupuesto / ventas_atribuidas, 2)
    
    if presupuesto > 0:
        roi = round(((monto_vendido - presupuesto) / presupuesto) * 100, 2)
    
    return {
        "dias_activos": dias_activos,
        "leads_generados": leads_generados,
        "leads_por_dia": leads_por_dia,
        "ventas_atribuidas": ventas_atribuidas,
        "monto_vendido": monto_vendido,
        "costo_por_lead": costo_por_lead,
        "costo_por_venta": costo_por_venta,
        "roi": roi
    }

@api_router.get("/campaigns", response_model=List[CampaignResponse])
async def get_campaigns(
    agency: Optional[str] = None,
    estado: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get all campaigns with metrics"""
    user_role = current_user["role"]
    user_agencies = current_user.get("agencies", [current_user["agency"]])
    
    # Check access permissions
    if user_role not in ROLES_VIEW_MARKETING and user_role not in ROLES_MANAGE_CAMPAIGNS:
        raise HTTPException(status_code=403, detail="No tienes acceso a las campañas")
    
    query = {}
    
    # Filter by agency based on role
    if user_role == "Gerente de Ventas" or user_role == "Marketing":
        if user_role == "Gerente de Ventas":
            # Only their agencies
            if agency:
                if agency not in user_agencies:
                    raise HTTPException(status_code=403, detail="No tienes acceso a esta agencia")
                query["agencia"] = agency
            else:
                query["agencia"] = {"$in": user_agencies}
        elif agency:
            query["agencia"] = agency
    elif agency:
        query["agencia"] = agency
    
    if estado:
        query["estado"] = estado
    
    campaigns = await db.campaigns.find(query).sort("created_at", -1).to_list(100)
    
    result = []
    for c in campaigns:
        metrics = await calculate_campaign_metrics(c)
        result.append(CampaignResponse(
            id=str(c["_id"]),
            nombre=c["nombre"],
            agencia=c["agencia"],
            canal=c["canal"],
            proveedor=c["proveedor"],
            tipo_campana=c["tipo_campana"],
            fecha_oferta_comercial=c.get("fecha_oferta_comercial"),
            fecha_aprobacion=c.get("fecha_aprobacion"),
            fecha_activacion=c.get("fecha_activacion"),
            fecha_finalizacion=c.get("fecha_finalizacion"),
            estado=c["estado"],
            presupuesto=c.get("presupuesto", 0) or 0,
            moneda=c.get("moneda", "MXN"),
            dias_activos=metrics["dias_activos"],
            leads_generados=metrics["leads_generados"],
            leads_por_dia=metrics["leads_por_dia"],
            ventas_atribuidas=metrics["ventas_atribuidas"],
            monto_vendido=metrics["monto_vendido"],
            costo_por_lead=metrics["costo_por_lead"],
            costo_por_venta=metrics["costo_por_venta"],
            roi=metrics["roi"],
            created_at=c["created_at"],
            updated_at=c.get("updated_at")
        ))
    
    return result

@api_router.get("/campaigns/active", response_model=List[CampaignResponse])
async def get_active_campaigns(
    agency: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get only active campaigns - for lead form selector"""
    query = {"estado": "Activa"}
    if agency:
        query["agencia"] = agency
    
    campaigns = await db.campaigns.find(query).sort("nombre", 1).to_list(100)
    
    result = []
    for c in campaigns:
        metrics = await calculate_campaign_metrics(c)
        result.append(CampaignResponse(
            id=str(c["_id"]),
            nombre=c["nombre"],
            agencia=c["agencia"],
            canal=c["canal"],
            proveedor=c["proveedor"],
            tipo_campana=c["tipo_campana"],
            fecha_oferta_comercial=c.get("fecha_oferta_comercial"),
            fecha_aprobacion=c.get("fecha_aprobacion"),
            fecha_activacion=c.get("fecha_activacion"),
            fecha_finalizacion=c.get("fecha_finalizacion"),
            estado=c["estado"],
            presupuesto=c.get("presupuesto", 0) or 0,
            moneda=c.get("moneda", "MXN"),
            dias_activos=metrics["dias_activos"],
            leads_generados=metrics["leads_generados"],
            leads_por_dia=metrics["leads_por_dia"],
            ventas_atribuidas=metrics["ventas_atribuidas"],
            monto_vendido=metrics["monto_vendido"],
            costo_por_lead=metrics["costo_por_lead"],
            costo_por_venta=metrics["costo_por_venta"],
            roi=metrics["roi"],
            created_at=c["created_at"],
            updated_at=c.get("updated_at")
        ))
    
    return result

@api_router.post("/campaigns", response_model=CampaignResponse)
async def create_campaign(campaign: CampaignCreate, current_user: dict = Depends(get_current_user)):
    """Create a new campaign - Gerente de Ventas Digitales only"""
    if current_user["role"] not in ROLES_MANAGE_CAMPAIGNS:
        raise HTTPException(status_code=403, detail="Solo el Gerente de Ventas Digitales puede crear campañas")
    
    if campaign.agencia not in AGENCIES:
        raise HTTPException(status_code=400, detail="Agencia inválida")
    if campaign.canal not in CAMPAIGN_CHANNELS:
        raise HTTPException(status_code=400, detail="Canal inválido")
    if campaign.proveedor not in CAMPAIGN_PROVIDERS:
        raise HTTPException(status_code=400, detail="Proveedor inválido")
    if campaign.tipo_campana not in CAMPAIGN_TYPES:
        raise HTTPException(status_code=400, detail="Tipo de campaña inválido")
    if campaign.estado not in CAMPAIGN_STATUSES:
        raise HTTPException(status_code=400, detail="Estado inválido")
    
    campaign_doc = {
        "nombre": campaign.nombre,
        "agencia": campaign.agencia,
        "canal": campaign.canal,
        "proveedor": campaign.proveedor,
        "tipo_campana": campaign.tipo_campana,
        "fecha_oferta_comercial": campaign.fecha_oferta_comercial,
        "fecha_aprobacion": campaign.fecha_aprobacion,
        "fecha_activacion": campaign.fecha_activacion,
        "fecha_finalizacion": campaign.fecha_finalizacion,
        "estado": campaign.estado,
        "presupuesto": campaign.presupuesto,
        "moneda": campaign.moneda,
        "created_at": datetime.utcnow(),
        "created_by": str(current_user["_id"])
    }
    
    result = await db.campaigns.insert_one(campaign_doc)
    campaign_doc["_id"] = result.inserted_id
    
    metrics = await calculate_campaign_metrics(campaign_doc)
    
    return CampaignResponse(
        id=str(campaign_doc["_id"]),
        nombre=campaign_doc["nombre"],
        agencia=campaign_doc["agencia"],
        canal=campaign_doc["canal"],
        proveedor=campaign_doc["proveedor"],
        tipo_campana=campaign_doc["tipo_campana"],
        fecha_oferta_comercial=campaign_doc.get("fecha_oferta_comercial"),
        fecha_aprobacion=campaign_doc.get("fecha_aprobacion"),
        fecha_activacion=campaign_doc.get("fecha_activacion"),
        fecha_finalizacion=campaign_doc.get("fecha_finalizacion"),
        estado=campaign_doc["estado"],
        presupuesto=campaign_doc.get("presupuesto", 0) or 0,
        moneda=campaign_doc.get("moneda", "MXN"),
        dias_activos=metrics["dias_activos"],
        leads_generados=metrics["leads_generados"],
        leads_por_dia=metrics["leads_por_dia"],
        ventas_atribuidas=metrics["ventas_atribuidas"],
        monto_vendido=metrics["monto_vendido"],
        costo_por_lead=metrics["costo_por_lead"],
        costo_por_venta=metrics["costo_por_venta"],
        roi=metrics["roi"],
        created_at=campaign_doc["created_at"],
        updated_at=None
    )

@api_router.get("/campaigns/{campaign_id}", response_model=CampaignResponse)
async def get_campaign(campaign_id: str, current_user: dict = Depends(get_current_user)):
    """Get a single campaign"""
    campaign = await db.campaigns.find_one({"_id": ObjectId(campaign_id)})
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaña no encontrada")
    
    metrics = await calculate_campaign_metrics(campaign)
    
    return CampaignResponse(
        id=str(campaign["_id"]),
        nombre=campaign["nombre"],
        agencia=campaign["agencia"],
        canal=campaign["canal"],
        proveedor=campaign["proveedor"],
        tipo_campana=campaign["tipo_campana"],
        fecha_oferta_comercial=campaign.get("fecha_oferta_comercial"),
        fecha_aprobacion=campaign.get("fecha_aprobacion"),
        fecha_activacion=campaign.get("fecha_activacion"),
        fecha_finalizacion=campaign.get("fecha_finalizacion"),
        estado=campaign["estado"],
        presupuesto=campaign.get("presupuesto", 0) or 0,
        moneda=campaign.get("moneda", "MXN"),
        dias_activos=metrics["dias_activos"],
        leads_generados=metrics["leads_generados"],
        leads_por_dia=metrics["leads_por_dia"],
        ventas_atribuidas=metrics["ventas_atribuidas"],
        monto_vendido=metrics["monto_vendido"],
        costo_por_lead=metrics["costo_por_lead"],
        costo_por_venta=metrics["costo_por_venta"],
        roi=metrics["roi"],
        created_at=campaign["created_at"],
        updated_at=campaign.get("updated_at")
    )

@api_router.patch("/campaigns/{campaign_id}", response_model=CampaignResponse)
async def update_campaign(campaign_id: str, campaign_update: CampaignUpdate, current_user: dict = Depends(get_current_user)):
    """Update a campaign - Gerente de Ventas Digitales only"""
    if current_user["role"] not in ROLES_MANAGE_CAMPAIGNS:
        raise HTTPException(status_code=403, detail="Solo el Gerente de Ventas Digitales puede editar campañas")
    
    campaign = await db.campaigns.find_one({"_id": ObjectId(campaign_id)})
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaña no encontrada")
    
    update_data = {}
    if campaign_update.nombre:
        update_data["nombre"] = campaign_update.nombre
    if campaign_update.agencia:
        if campaign_update.agencia not in AGENCIES:
            raise HTTPException(status_code=400, detail="Agencia inválida")
        update_data["agencia"] = campaign_update.agencia
    if campaign_update.canal:
        if campaign_update.canal not in CAMPAIGN_CHANNELS:
            raise HTTPException(status_code=400, detail="Canal inválido")
        update_data["canal"] = campaign_update.canal
    if campaign_update.proveedor:
        if campaign_update.proveedor not in CAMPAIGN_PROVIDERS:
            raise HTTPException(status_code=400, detail="Proveedor inválido")
        update_data["proveedor"] = campaign_update.proveedor
    if campaign_update.tipo_campana:
        if campaign_update.tipo_campana not in CAMPAIGN_TYPES:
            raise HTTPException(status_code=400, detail="Tipo de campaña inválido")
        update_data["tipo_campana"] = campaign_update.tipo_campana
    if campaign_update.fecha_oferta_comercial is not None:
        update_data["fecha_oferta_comercial"] = campaign_update.fecha_oferta_comercial
    if campaign_update.fecha_aprobacion is not None:
        update_data["fecha_aprobacion"] = campaign_update.fecha_aprobacion
    if campaign_update.fecha_activacion is not None:
        update_data["fecha_activacion"] = campaign_update.fecha_activacion
    if campaign_update.fecha_finalizacion is not None:
        update_data["fecha_finalizacion"] = campaign_update.fecha_finalizacion
    if campaign_update.estado:
        if campaign_update.estado not in CAMPAIGN_STATUSES:
            raise HTTPException(status_code=400, detail="Estado inválido")
        update_data["estado"] = campaign_update.estado
    if campaign_update.presupuesto is not None:
        update_data["presupuesto"] = campaign_update.presupuesto
    if campaign_update.moneda:
        update_data["moneda"] = campaign_update.moneda
    
    update_data["updated_at"] = datetime.utcnow()
    
    await db.campaigns.update_one({"_id": ObjectId(campaign_id)}, {"$set": update_data})
    
    updated_campaign = await db.campaigns.find_one({"_id": ObjectId(campaign_id)})
    metrics = await calculate_campaign_metrics(updated_campaign)
    
    return CampaignResponse(
        id=str(updated_campaign["_id"]),
        nombre=updated_campaign["nombre"],
        agencia=updated_campaign["agencia"],
        canal=updated_campaign["canal"],
        proveedor=updated_campaign["proveedor"],
        tipo_campana=updated_campaign["tipo_campana"],
        fecha_oferta_comercial=updated_campaign.get("fecha_oferta_comercial"),
        fecha_aprobacion=updated_campaign.get("fecha_aprobacion"),
        fecha_activacion=updated_campaign.get("fecha_activacion"),
        fecha_finalizacion=updated_campaign.get("fecha_finalizacion"),
        estado=updated_campaign["estado"],
        presupuesto=updated_campaign.get("presupuesto", 0) or 0,
        moneda=updated_campaign.get("moneda", "MXN"),
        dias_activos=metrics["dias_activos"],
        leads_generados=metrics["leads_generados"],
        leads_por_dia=metrics["leads_por_dia"],
        ventas_atribuidas=metrics["ventas_atribuidas"],
        monto_vendido=metrics["monto_vendido"],
        costo_por_lead=metrics["costo_por_lead"],
        costo_por_venta=metrics["costo_por_venta"],
        roi=metrics["roi"],
        created_at=updated_campaign["created_at"],
        updated_at=updated_campaign.get("updated_at")
    )

@api_router.delete("/campaigns/{campaign_id}")
async def delete_campaign(campaign_id: str, current_user: dict = Depends(get_current_user)):
    """Delete a campaign - Gerente de Ventas Digitales only"""
    if current_user["role"] not in ROLES_MANAGE_CAMPAIGNS:
        raise HTTPException(status_code=403, detail="Solo el Gerente de Ventas Digitales puede eliminar campañas")
    
    campaign = await db.campaigns.find_one({"_id": ObjectId(campaign_id)})
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaña no encontrada")
    
    # Unlink leads from this campaign
    await db.leads.update_many({"campaign_id": campaign_id}, {"$set": {"campaign_id": None}})
    
    await db.campaigns.delete_one({"_id": ObjectId(campaign_id)})
    
    return {"message": "Campaña eliminada correctamente"}

# ==================== MARKETING DASHBOARD ====================

@api_router.get("/marketing/dashboard")
async def get_marketing_dashboard(
    filter_type: str = "month",
    agency: Optional[str] = None,
    campaign_id: Optional[str] = None,
    year: Optional[int] = None,
    start_date_param: Optional[str] = None,
    end_date_param: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get marketing intelligence dashboard data"""
    user_role = current_user["role"]
    user_agencies = current_user.get("agencies", [current_user["agency"]])
    
    # Check access permissions
    if user_role not in ROLES_VIEW_MARKETING:
        raise HTTPException(status_code=403, detail="No tienes acceso al dashboard de marketing")
    
    now = datetime.utcnow()
    current_year = year or now.year
    
    # If custom date range provided, use it
    if start_date_param and end_date_param:
        try:
            start_date = datetime.fromisoformat(start_date_param.replace('Z', '+00:00').replace('+00:00', ''))
            end_date = datetime.fromisoformat(end_date_param.replace('Z', '+00:00').replace('+00:00', ''))
            end_date = end_date.replace(hour=23, minute=59, second=59, microsecond=999999)
            date_filter = {"$gte": start_date, "$lte": end_date}
        except:
            # Fallback to filter_type
            if filter_type == "day":
                start_date = now.replace(hour=0, minute=0, second=0, microsecond=0)
            elif filter_type == "week":
                start_date = now - timedelta(days=now.weekday())
                start_date = start_date.replace(hour=0, minute=0, second=0, microsecond=0)
            elif filter_type == "year":
                start_date = datetime(current_year, 1, 1)
            else:  # month
                start_date = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
            date_filter = {"$gte": start_date}
    else:
        # Calculate date range based on filter_type
        if filter_type == "day":
            start_date = now.replace(hour=0, minute=0, second=0, microsecond=0)
        elif filter_type == "week":
            start_date = now - timedelta(days=now.weekday())
            start_date = start_date.replace(hour=0, minute=0, second=0, microsecond=0)
        elif filter_type == "year":
            start_date = datetime(current_year, 1, 1)
        else:  # month
            start_date = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        date_filter = {"$gte": start_date}
    
    # Build query based on filters
    lead_query = {"created_at": date_filter}
    
    # Agency filter based on role
    if user_role == "Gerente de Ventas":
        if agency:
            if agency not in user_agencies:
                raise HTTPException(status_code=403, detail="No tienes acceso a esta agencia")
            lead_query["agency"] = agency
        else:
            lead_query["agency"] = {"$in": user_agencies}
    elif agency:
        lead_query["agency"] = agency
    
    if campaign_id:
        lead_query["campaign_id"] = campaign_id
    
    # A) Leads by origin (for pie chart)
    origin_pipeline = [
        {"$match": lead_query},
        {"$group": {"_id": "$origin", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}}
    ]
    leads_by_origin = await db.leads.aggregate(origin_pipeline).to_list(20)
    
    # B) & C) Campaign metrics
    campaign_query = {}
    if user_role == "Gerente de Ventas":
        campaign_query["agencia"] = {"$in": user_agencies}
    elif agency:
        campaign_query["agencia"] = agency
    
    campaigns = await db.campaigns.find(campaign_query).to_list(100)
    campaign_metrics = []
    for c in campaigns:
        metrics = await calculate_campaign_metrics(c)
        campaign_metrics.append({
            "id": str(c["_id"]),
            "nombre": c["nombre"],
            "agencia": c["agencia"],
            "estado": c["estado"],
            "dias_activos": metrics["dias_activos"],
            "leads_generados": metrics["leads_generados"],
            "leads_por_dia": metrics["leads_por_dia"]
        })
    
    # E) Leads by day of week
    dow_pipeline = [
        {"$match": lead_query},
        {"$project": {"dayOfWeek": {"$dayOfWeek": "$created_at"}}},
        {"$group": {"_id": "$dayOfWeek", "count": {"$sum": 1}}},
        {"$sort": {"_id": 1}}
    ]
    leads_by_dow = await db.leads.aggregate(dow_pipeline).to_list(7)
    day_names = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"]
    leads_by_day_of_week = [
        {"day": day_names[item["_id"] - 1], "count": item["count"]}
        for item in leads_by_dow
    ]
    
    # F) Lead trend (leads per day of month)
    trend_pipeline = [
        {"$match": lead_query},
        {"$project": {"day": {"$dayOfMonth": "$created_at"}}},
        {"$group": {"_id": "$day", "count": {"$sum": 1}}},
        {"$sort": {"_id": 1}}
    ]
    lead_trend = await db.leads.aggregate(trend_pipeline).to_list(31)
    
    # Funnel data
    funnel_data = []
    for stage in FUNNEL_STAGES:
        stage_query = {**lead_query, "stage": stage}
        count = await db.leads.count_documents(stage_query)
        funnel_data.append({"stage": stage, "count": count})
    
    # DCA Performance
    dca_pipeline = [
        {"$match": lead_query},
        {"$group": {
            "_id": {"dca_id": "$dca_id", "dca_name": "$dca_name"},
            "total_leads": {"$sum": 1},
            "contactados": {"$sum": {"$cond": [{"$in": ["$stage", ["Contactado", "Citado", "Cumplida", "Demo", "Cierre", "Facturada"]]}, 1, 0]}},
            "citados": {"$sum": {"$cond": [{"$in": ["$stage", ["Citado", "Cumplida", "Demo", "Cierre", "Facturada"]]}, 1, 0]}},
            "cumplidas": {"$sum": {"$cond": [{"$in": ["$stage", ["Cumplida", "Demo", "Cierre", "Facturada"]]}, 1, 0]}}
        }},
        {"$sort": {"total_leads": -1}},
        {"$limit": 10}
    ]
    dca_performance = await db.leads.aggregate(dca_pipeline).to_list(10)
    
    # Asesor Performance
    asesor_pipeline = [
        {"$match": {**lead_query, "asesor_id": {"$exists": True, "$ne": None}}},
        {"$group": {
            "_id": {"asesor_id": "$asesor_id", "asesor_name": "$asesor_name"},
            "total_asignados": {"$sum": 1},
            "demos": {"$sum": {"$cond": [{"$in": ["$stage", ["Demo", "Cierre", "Facturada"]]}, 1, 0]}},
            "cierres": {"$sum": {"$cond": [{"$in": ["$stage", ["Cierre", "Facturada"]]}, 1, 0]}},
            "facturadas": {"$sum": {"$cond": [{"$eq": ["$stage", "Facturada"]}, 1, 0]}}
        }},
        {"$sort": {"facturadas": -1}},
        {"$limit": 10}
    ]
    asesor_performance = await db.leads.aggregate(asesor_pipeline).to_list(10)
    
    # Calculate conversion rate for asesores
    for asesor in asesor_performance:
        if asesor["total_asignados"] > 0:
            asesor["conversion_rate"] = round((asesor["facturadas"] / asesor["total_asignados"]) * 100, 1)
        else:
            asesor["conversion_rate"] = 0.0
    
    # Total metrics
    total_leads = await db.leads.count_documents(lead_query)
    total_facturadas = await db.leads.count_documents({**lead_query, "stage": "Facturada"})
    conversion_rate = round((total_facturadas / total_leads * 100) if total_leads > 0 else 0, 1)
    
    return {
        "filter_type": filter_type,
        "start_date": start_date.isoformat(),
        "total_leads": total_leads,
        "total_facturadas": total_facturadas,
        "conversion_rate": conversion_rate,
        "leads_by_origin": [{"origin": item["_id"] or "Sin origen", "count": item["count"]} for item in leads_by_origin],
        "campaign_metrics": campaign_metrics,
        "leads_by_day_of_week": leads_by_day_of_week,
        "lead_trend": [{"day": item["_id"], "count": item["count"]} for item in lead_trend],
        "funnel_data": funnel_data,
        "dca_performance": [
            {
                "dca_id": item["_id"]["dca_id"],
                "dca_name": item["_id"]["dca_name"] or "Sin nombre",
                "total_leads": item["total_leads"],
                "contactados": item["contactados"],
                "citados": item["citados"],
                "cumplidas": item["cumplidas"]
            }
            for item in dca_performance
        ],
        "asesor_performance": [
            {
                "asesor_id": item["_id"]["asesor_id"],
                "asesor_name": item["_id"]["asesor_name"] or "Sin nombre",
                "total_asignados": item["total_asignados"],
                "demos": item["demos"],
                "cierres": item["cierres"],
                "facturadas": item["facturadas"],
                "conversion_rate": item["conversion_rate"]
            }
            for item in asesor_performance
        ]
    }

# ==================== CONFIG ROUTES ====================

@api_router.get("/config")
async def get_config():
    return {
        "agencies": AGENCIES,
        "roles": ROLES,
        "funnel_stages": FUNNEL_STAGES,
        "sale_types": SALE_TYPES,
        "origins": ORIGINS,
        "health_thresholds": HEALTH_THRESHOLDS,
        "campaign_channels": CAMPAIGN_CHANNELS,
        "campaign_providers": CAMPAIGN_PROVIDERS,
        "campaign_types": CAMPAIGN_TYPES,
        "campaign_statuses": CAMPAIGN_STATUSES
    }

@api_router.get("/")
async def root():
    return {"message": "DCAPP V1 API", "version": "1.0"}

# Include router
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
