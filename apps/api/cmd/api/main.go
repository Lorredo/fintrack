package main

import (
	"context"
	"log"
	"os"
	"os/signal"
	"syscall"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/logger"
	"github.com/gofiber/fiber/v2/middleware/recover"

	"github.com/Lorredo/fintrack/api/internal/config"
	"github.com/Lorredo/fintrack/api/internal/database"
	"github.com/Lorredo/fintrack/api/internal/handlers"
	"github.com/Lorredo/fintrack/api/internal/routes"
	"github.com/Lorredo/fintrack/api/internal/services"
)

func main() {
	cfg := config.Load()

	// Database connection
	ctx := context.Background()
	if err := database.Connect(ctx, cfg.DatabaseURL); err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer database.Close()

	// Run migrations
	if err := database.RunMigrations(cfg.DatabaseURL, cfg.MigrationsPath); err != nil {
		log.Fatalf("Failed to run migrations: %v", err)
	}

	// Fiber app
	app := fiber.New(fiber.Config{
		AppName: "Fintrack API",
	})

	// Middleware
	app.Use(recover.New())
	app.Use(logger.New())
	app.Use(cors.New(cors.Config{
		AllowOrigins: "*",
		AllowMethods: "GET,POST,PUT,PATCH,DELETE,OPTIONS",
		AllowHeaders: "Origin,Content-Type,Accept,Authorization",
	}))

	// Handlers
	authHandler := handlers.NewAuthHandler(
		cfg.JWTSecret,
		cfg.JWTAccessExpiry,
		cfg.JWTRefreshExpiry,
	)

	transactionService := services.NewTransactionService(database.Pool)
	transactionHandler := handlers.NewTransactionHandler(transactionService)

	dashboardService := services.NewDashboardService(database.Pool)
	dashboardHandler := handlers.NewDashboardHandler(dashboardService)

	budgetService := services.NewBudgetService(database.Pool)
	budgetHandler := handlers.NewBudgetHandler(budgetService)

	reportService := services.NewReportService(database.Pool)
	reportHandler := handlers.NewReportHandler(reportService)

	// Routes
	routes.Setup(app, authHandler, transactionHandler, dashboardHandler, budgetHandler, reportHandler)

	// Graceful shutdown
	go func() {
		quit := make(chan os.Signal, 1)
		signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
		<-quit
		log.Println("Shutting down server...")
		_ = app.Shutdown()
	}()

	// Start server
	addr := ":" + cfg.ServerPort
	log.Printf("Server starting on %s", addr)
	if err := app.Listen(addr); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
