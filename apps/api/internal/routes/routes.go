package routes

import (
	"github.com/gofiber/fiber/v2"

	"github.com/Lorredo/fintrack/api/internal/handlers"
	"github.com/Lorredo/fintrack/api/internal/middleware"
)

func Setup(app *fiber.App, authHandler *handlers.AuthHandler, transactionHandler *handlers.TransactionHandler, dashboardHandler *handlers.DashboardHandler, budgetHandler *handlers.BudgetHandler) {
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
	auth.Post("/refresh", authHandler.Refresh)

	// Auth routes (protected)
	auth.Post("/logout", middleware.AuthRequired(), authHandler.Logout)
	auth.Get("/me", middleware.AuthRequired(), authHandler.Me)

	// Transaction routes (protected)
	transactions := api.Group("/transactions", middleware.AuthRequired())
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
	budgets.Get("/", budgetHandler.List)
	budgets.Get("/:id", budgetHandler.Get)
	budgets.Post("/", budgetHandler.Create)
	budgets.Put("/:id", budgetHandler.Update)
	budgets.Delete("/:id", budgetHandler.Delete)
}
