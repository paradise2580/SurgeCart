package com.surgecart.controller;

import com.surgecart.dto.AuthResponse;
import com.surgecart.dto.LoginRequest;
import com.surgecart.dto.RegisterRequest;
import com.surgecart.exception.BadCredentialsAppException;
import com.surgecart.service.AuthService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
@Tag(name = "Auth")
public class AuthController {

    private static final String REFRESH_COOKIE = "refresh_token";

    private final AuthService authService;

    @PostMapping("/register")
    @Operation(summary = "Create an account and start a session")
    public ResponseEntity<AuthResponse> register(@Valid @RequestBody RegisterRequest request,
                                                  HttpServletResponse response) {
        var pair = authService.register(request);
        setRefreshCookie(response, pair.refreshToken());
        return ResponseEntity.ok(AuthService.toAuthResponse(pair));
    }

    @PostMapping("/login")
    @Operation(summary = "Exchange credentials for an access token")
    public ResponseEntity<AuthResponse> login(@Valid @RequestBody LoginRequest request,
                                               HttpServletResponse response) {
        var pair = authService.login(request);
        setRefreshCookie(response, pair.refreshToken());
        return ResponseEntity.ok(AuthService.toAuthResponse(pair));
    }

    @PostMapping("/refresh")
    @Operation(summary = "Rotate the refresh cookie and issue a new access token")
    public ResponseEntity<AuthResponse> refresh(@CookieValue(name = REFRESH_COOKIE, required = false) String refreshToken,
                                                 HttpServletResponse response) {
        if (refreshToken == null) {
            throw new BadCredentialsAppException();
        }
        var pair = authService.refresh(refreshToken);
        setRefreshCookie(response, pair.refreshToken());
        return ResponseEntity.ok(AuthService.toAuthResponse(pair));
    }

    @PostMapping("/logout")
    public ResponseEntity<Void> logout(Authentication authentication, HttpServletResponse response) {
        if (authentication != null) {
            authService.logout(authentication.getName());
        }
        clearRefreshCookie(response);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/me")
    public ResponseEntity<String> me(Authentication authentication) {
        return ResponseEntity.ok(authentication.getName());
    }

    private void setRefreshCookie(HttpServletResponse response, String token) {
        ResponseCookie cookie = ResponseCookie.from(REFRESH_COOKIE, token)
                .httpOnly(true)
                .secure(true)
                .sameSite("None")
                .path("/api/auth")
                .maxAge(7 * 24 * 60 * 60)
                .build();
        response.addHeader("Set-Cookie", cookie.toString());
    }

    private void clearRefreshCookie(HttpServletResponse response) {
        ResponseCookie cookie = ResponseCookie.from(REFRESH_COOKIE, "")
                .httpOnly(true).secure(true).sameSite("None").path("/api/auth").maxAge(0).build();
        response.addHeader("Set-Cookie", cookie.toString());
    }
}
