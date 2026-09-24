package com.surgecart.service;

import com.surgecart.domain.Enums;
import com.surgecart.domain.User;
import com.surgecart.dto.AuthResponse;
import com.surgecart.dto.LoginRequest;
import com.surgecart.dto.RegisterRequest;
import com.surgecart.exception.BadCredentialsAppException;
import com.surgecart.exception.EmailInUseException;
import com.surgecart.repository.UserRepository;
import com.surgecart.security.JwtService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.bcrypt.BCrypt;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Refresh-token rotation: every /refresh call issues a brand new refresh
 * token and overwrites the stored hash of the old one. If a stolen refresh
 * token is replayed after the legitimate user already rotated past it, the
 * hash comparison fails — that mismatch is a detectable theft signal, and
 * the session can be force-revoked from there. A non-rotating refresh token
 * gives you no such signal.
 */
@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;

    public record TokenPair(String accessToken, String refreshToken, long expiresIn, String email, String role) {}

    @Transactional
    public TokenPair register(RegisterRequest request) {
        if (userRepository.existsByEmail(request.email())) {
            throw new EmailInUseException(request.email());
        }

        User user = User.builder()
                .email(request.email())
                .passwordHash(passwordEncoder.encode(request.password()))
                .role(Enums.Role.BUYER)
                .build();
        userRepository.save(user);

        return issueTokens(user);
    }

    @Transactional
    public TokenPair login(LoginRequest request) {
        User user = userRepository.findByEmail(request.email())
                .orElseThrow(BadCredentialsAppException::new);

        if (!passwordEncoder.matches(request.password(), user.getPasswordHash())) {
            throw new BadCredentialsAppException();
        }

        return issueTokens(user);
    }

    @Transactional
    public TokenPair refresh(String presentedRefreshToken) {
        String email = jwtService.extractEmail(presentedRefreshToken);
        User user = userRepository.findByEmail(email)
                .orElseThrow(BadCredentialsAppException::new);

        if (jwtService.isExpired(presentedRefreshToken)
                || user.getRefreshTokenHash() == null
                || !BCrypt.checkpw(presentedRefreshToken, user.getRefreshTokenHash())) {
            throw new BadCredentialsAppException();
        }

        return issueTokens(user);
    }

    @Transactional
    public void logout(String email) {
        userRepository.findByEmail(email).ifPresent(u -> {
            u.setRefreshTokenHash(null);
            userRepository.save(u);
        });
    }

    private TokenPair issueTokens(User user) {
        String access = jwtService.generateAccessToken(user.getEmail(), user.getRole().name());
        String refresh = jwtService.generateRefreshToken(user.getEmail());

        user.setRefreshTokenHash(BCrypt.hashpw(refresh, BCrypt.gensalt()));
        userRepository.save(user);

        return new TokenPair(access, refresh, jwtService.accessTtlSeconds(), user.getEmail(), user.getRole().name());
    }

    public static AuthResponse toAuthResponse(TokenPair pair) {
        return new AuthResponse(pair.accessToken(), pair.expiresIn(), pair.email(), pair.role());
    }
}
