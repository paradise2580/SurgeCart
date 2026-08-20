package handler

import (
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"time"

	"github.com/google/uuid"
	"github.com/surgecart/reserve-gateway/internal/store"
)

type Handler struct {
	store          *store.Store
	reservationTTL int
	logger         *slog.Logger
}

func New(s *store.Store, ttlSeconds int, logger *slog.Logger) *Handler {
	return &Handler{store: s, reservationTTL: ttlSeconds, logger: logger}
}

type reserveRequest struct {
	SaleID   string `json:"saleId"`
	UserID   string `json:"userId"`
	Quantity int    `json:"quantity"`
	PerUserLimit int `json:"perUserLimit"`
}

type reserveResponse struct {
	Token          string `json:"token"`
	StockRemaining int64  `json:"stockRemaining"`
	ExpiresAt      string `json:"expiresAt"`
}

type errorResponse struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

// Reserve mirrors ReservationService.reserve in the Java core-api exactly —
// same Redis keys, same Lua script, same three rejection codes — so the
// two are drop-in interchangeable and directly A/B benchmarkable.
func (h *Handler) Reserve(w http.ResponseWriter, r *http.Request) {
	var req reserveRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "BAD_REQUEST", "invalid request body")
		return
	}
	if req.SaleID == "" || req.UserID == "" || req.Quantity < 1 {
		writeError(w, http.StatusBadRequest, "BAD_REQUEST", "saleId, userId, and a positive quantity are required")
		return
	}
	if req.PerUserLimit == 0 {
		req.PerUserLimit = 1
	}

	token := uuid.NewString()
	payload := fmt.Sprintf(`{"userId":"%s","saleId":"%s","qty":%d}`, req.UserID, req.SaleID, req.Quantity)

	result, err := h.store.Reserve(r.Context(), req.SaleID, req.UserID, req.Quantity, req.PerUserLimit, h.reservationTTL, token, payload)
	if err != nil {
		h.logger.Error("reserve failed", "error", err, "saleId", req.SaleID)
		writeError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "reservation could not be processed")
		return
	}

	switch result.Code {
	case 1:
		resp := reserveResponse{
			Token:          token,
			StockRemaining: result.StockRemaining,
			ExpiresAt:      time.Now().Add(time.Duration(h.reservationTTL) * time.Second).UTC().Format(time.RFC3339),
		}
		writeJSON(w, http.StatusCreated, resp)
	case -1:
		writeError(w, http.StatusConflict, "SOLD_OUT", "this sale is sold out")
	case -2:
		writeError(w, http.StatusConflict, "USER_LIMIT_EXCEEDED", "per-user purchase limit reached")
	case -3:
		writeError(w, http.StatusConflict, "SALE_NOT_LIVE", "this sale is not currently live")
	default:
		writeError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "unexpected reservation outcome")
	}
}

type releaseRequest struct {
	SaleID   string `json:"saleId"`
	UserID   string `json:"userId"`
	Token    string `json:"token"`
	Quantity int    `json:"quantity"`
}

func (h *Handler) Release(w http.ResponseWriter, r *http.Request) {
	var req releaseRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "BAD_REQUEST", "invalid request body")
		return
	}
	if req.Quantity < 1 {
		req.Quantity = 1
	}

	released, err := h.store.Release(r.Context(), req.SaleID, req.UserID, req.Token, req.Quantity)
	if err != nil {
		h.logger.Error("release failed", "error", err, "token", req.Token)
		writeError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "release could not be processed")
		return
	}

	writeJSON(w, http.StatusOK, map[string]bool{"released": released})
}

func (h *Handler) Health(w http.ResponseWriter, r *http.Request) {
	if err := h.store.Ping(r.Context()); err != nil {
		writeError(w, http.StatusServiceUnavailable, "REDIS_DOWN", "redis ping failed")
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "UP"})
}

func writeJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(body)
}

func writeError(w http.ResponseWriter, status int, code, message string) {
	writeJSON(w, status, errorResponse{Code: code, Message: message})
}
