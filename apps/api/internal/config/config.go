package config

import (
	"os"
	"strings"
	"time"

	"github.com/joho/godotenv"
)

type Config struct {
	ServerPort       string
	DatabaseURL      string
	JWTSecret        string
	JWTAccessExpiry  time.Duration
	JWTRefreshExpiry time.Duration
	MigrationsPath   string
	// OAuth client IDs that Google ID tokens may be issued to (web + Android).
	GoogleClientIDs []string
	AppleBundleID   string
}

func Load() *Config {
	_ = godotenv.Load()

	return &Config{
		ServerPort:       getEnv("SERVER_PORT", "8080"),
		DatabaseURL:      getEnv("DATABASE_URL", "postgres://fintrack:fintrack@localhost:5434/fintrack?sslmode=disable"),
		JWTSecret:        getEnv("JWT_SECRET", "3f3c8766b9eb689a689af8b23b72faf1"),
		JWTAccessExpiry:  parseDuration(getEnv("JWT_ACCESS_EXPIRY", "15m")),
		JWTRefreshExpiry: parseDuration(getEnv("JWT_REFRESH_EXPIRY", "168h")), // 7 days
		MigrationsPath:   getEnv("MIGRATIONS_PATH", "../../../database/migrations"),
		GoogleClientIDs: splitList(getEnv("GOOGLE_CLIENT_IDS",
			"682216887168-hqedik3sofat58a10vt7uaemcooo5l8j.apps.googleusercontent.com,"+
				"682216887168-r35b05lnr0q4f9plqvu27e86afjeuad3.apps.googleusercontent.com")),
		AppleBundleID: getEnv("APPLE_BUNDLE_ID", "com.fintrack.app"),
	}
}

func getEnv(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}

func splitList(s string) []string {
	var out []string
	for _, part := range strings.Split(s, ",") {
		if part = strings.TrimSpace(part); part != "" {
			out = append(out, part)
		}
	}
	return out
}

func parseDuration(s string) time.Duration {
	d, err := time.ParseDuration(s)
	if err != nil {
		return 15 * time.Minute
	}
	return d
}
