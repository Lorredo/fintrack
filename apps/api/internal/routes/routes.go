package routes

import (
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/limiter"

	"github.com/Lorredo/fintrack/api/internal/handlers"
	"github.com/Lorredo/fintrack/api/internal/middleware"
)

func Setup(app *fiber.App, authHandler *handlers.AuthHandler, transactionHandler *handlers.TransactionHandler, dashboardHandler *handlers.DashboardHandler, budgetHandler *handlers.BudgetHandler, reportHandler *handlers.ReportHandler, accountHandler *handlers.AccountHandler) {
	api := app.Group("/api/v1")

	// Health check
	api.Get("/health", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{
			"status": "ok",
		})
	})

	// Auth routes (public)
	auth := api.Group("/auth")
	auth.Post("/register", authHandler.Register)
	auth.Post("/login", authHandler.Login)
	auth.Post("/pin-login", pinLoginLimiter(), authHandler.PinLogin)
	auth.Post("/google", authHandler.GoogleLogin)
	auth.Post("/apple", authHandler.AppleLogin)
	auth.Post("/refresh", authHandler.Refresh)

	// Auth routes (protected)

	auth.Post("/logout", middleware.AuthRequired(), authHandler.Logout)
	auth.Get("/me", middleware.AuthRequired(), authHandler.Me)
	auth.Post("/pin", middleware.AuthRequired(), authHandler.SetPIN)
	auth.Post("/pin/verify", middleware.AuthRequired(), authHandler.VerifyPIN)
	auth.Delete("/wipe-data", middleware.AuthRequired(), authHandler.WipeData)

	// Transaction routes (protected)
	transactions := api.Group("/transactions", middleware.AuthRequired())
	transactions.Get("/categories/all", transactionHandler.Categories)
	transactions.Get("/", transactionHandler.List)
	transactions.Get("/:id", transactionHandler.Get)
	transactions.Post("/", transactionHandler.Create)
	transactions.Put("/:id", transactionHandler.Update)
	transactions.Delete("/:id", transactionHandler.Delete)

	// Dashboard routes (protected)
	dashboard := api.Group("/dashboard", middleware.AuthRequired())
	dashboard.Get("/summary", dashboardHandler.Summary)

	// Budget routes (protected)
	budgets := api.Group("/budgets", middleware.AuthRequired())
	budgets.Post("/rebalance", budgetHandler.Rebalance)
	budgets.Get("/", budgetHandler.List)
	budgets.Get("/:id", budgetHandler.Get)
	budgets.Post("/", budgetHandler.Create)
	budgets.Put("/:id", budgetHandler.Update)
	budgets.Delete("/:id", budgetHandler.Delete)

	// Report routes (protected)
	reports := api.Group("/reports", middleware.AuthRequired())
	reports.Get("/trends", reportHandler.Trends)
	reports.Get("/categories", reportHandler.Categories)
	reports.Get("/export", reportHandler.Export)

	// Account routes (protected)
	accounts := api.Group("/accounts", middleware.AuthRequired())
	accounts.Get("/", accountHandler.List)
	accounts.Post("/", accountHandler.Create)
	accounts.Put("/:id", accountHandler.Update)
	accounts.Delete("/:id", accountHandler.Delete)
}

// pinLoginLimiter caps PIN attempts per client IP and email. A 4-digit PIN
// has only 10,000 combinations, so unthrottled guessing is trivial.
func pinLoginLimiter() fiber.Handler {
	return limiter.New(limiter.Config{
		Max:        5,
		Expiration: 15 * time.Minute,
		// Only failed attempts count toward the limit.
		SkipSuccessfulRequests: true,
		KeyGenerator: func(c *fiber.Ctx) string {
			var body struct {
				Email string `json:"email"`
			}
			_ = c.BodyParser(&body)
			return c.IP() + "|" + strings.ToLower(strings.TrimSpace(body.Email))
		},
		LimitReached: func(c *fiber.Ctx) error {
			return c.Status(fiber.StatusTooManyRequests).JSON(fiber.Map{
				"message": "Too many PIN attempts. Please try again later.",
			})
		},
	})
}
