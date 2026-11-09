package routes

import (
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/limiter"

	"github.com/Lorredo/fintrack/api/internal/handlers"
	"github.com/Lorredo/fintrack/api/internal/middleware"
)

func Setup(app *fiber.App, jwtSecret string, authHandler *handlers.AuthHandler, transactionHandler *handlers.TransactionHandler, dashboardHandler *handlers.DashboardHandler, budgetHandler *handlers.BudgetHandler, reportHandler *handlers.ReportHandler, accountHandler *handlers.AccountHandler, billHandler *handlers.BillHandler, utangHandler *handlers.UtangHandler) {
	api := app.Group("/api/v1")
	authRequired := middleware.AuthRequired(jwtSecret)

	// Health check
	api.Get("/health", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{
			"status": "ok",
		})
	})

	// Auth routes (public)
	auth := api.Group("/auth")
	auth.Post("/register", authHandler.Register)
	auth.Post("/login", credentialLimiter(10, "Too many sign-in attempts. Please try again later."), authHandler.Login)
	auth.Post("/pin-login", credentialLimiter(5, "Too many PIN attempts. Please try again later."), authHandler.PinLogin)
	auth.Post("/recover", credentialLimiter(10, "Too many recovery attempts. Please try again later."), authHandler.Recover)
	auth.Post("/recover/google", socialLoginLimiter(), authHandler.RecoverWithGoogle)
	auth.Post("/google", socialLoginLimiter(), authHandler.GoogleLogin)
	auth.Post("/apple", socialLoginLimiter(), authHandler.AppleLogin)
	auth.Post("/refresh", authHandler.Refresh)

	// Auth routes (protected)

	auth.Post("/logout", authRequired, authHandler.Logout)
	auth.Post("/logout-all", authRequired, authHandler.LogoutAll)
	auth.Post("/recovery-code", authRequired, authHandler.CreateRecoveryCode)
	auth.Get("/me", authRequired, authHandler.Me)
	auth.Post("/pin", authRequired, authHandler.SetPIN)
	auth.Post("/pin/verify", authRequired, authHandler.VerifyPIN)
	auth.Delete("/wipe-data", authRequired, authHandler.WipeData)

	// Transaction routes (protected)
	transactions := api.Group("/transactions", authRequired)
	transactions.Get("/categories/all", transactionHandler.Categories)
	transactions.Get("/", transactionHandler.List)
	transactions.Get("/:id", transactionHandler.Get)
	transactions.Post("/", transactionHandler.Create)
	transactions.Put("/:id", transactionHandler.Update)
	transactions.Delete("/:id", transactionHandler.Delete)

	// Dashboard routes (protected)
	dashboard := api.Group("/dashboard", authRequired)
	dashboard.Get("/summary", dashboardHandler.Summary)
	dashboard.Get("/safe-to-spend", billHandler.SafeToSpend)

	// Bill routes (protected)
	bills := api.Group("/bills", authRequired)
	bills.Get("/", billHandler.List)
	bills.Post("/", billHandler.Create)
	bills.Put("/:id", billHandler.Update)
	bills.Delete("/:id", billHandler.Delete)
	bills.Post("/:id/pay", billHandler.Pay)
	bills.Post("/:id/skip", billHandler.Skip)

	// Utang (protected)
	debts := api.Group("/debts", authRequired)
	debts.Get("/", utangHandler.ListDebts)
	debts.Post("/", utangHandler.CreateDebt)
	debts.Put("/:id", utangHandler.UpdateDebt)
	debts.Delete("/:id", utangHandler.DeleteDebt)
	debts.Post("/:id/payments", utangHandler.AddDebtPayment)
	debts.Delete("/:id/payments/:paymentId", utangHandler.DeleteDebtPayment)

	// Paluwagan (protected)
	paluwagans := api.Group("/paluwagans", authRequired)
	paluwagans.Get("/", utangHandler.ListPaluwagans)
	paluwagans.Post("/", utangHandler.CreatePaluwagan)
	paluwagans.Put("/:id", utangHandler.UpdatePaluwagan)
	paluwagans.Delete("/:id", utangHandler.DeletePaluwagan)
	paluwagans.Post("/:id/contribute", utangHandler.Contribute)
	paluwagans.Post("/:id/payout", utangHandler.ReceivePayout)

	// Payday and savings settings (protected)
	settings := api.Group("/settings", authRequired)
	settings.Get("/", billHandler.GetSettings)
	settings.Put("/", billHandler.UpdateSettings)

	// Budget routes (protected)
	budgets := api.Group("/budgets", authRequired)
	budgets.Post("/rebalance", budgetHandler.Rebalance)
	budgets.Get("/", budgetHandler.List)
	budgets.Get("/:id", budgetHandler.Get)
	budgets.Post("/", budgetHandler.Create)
	budgets.Put("/:id", budgetHandler.Update)
	budgets.Delete("/:id", budgetHandler.Delete)

	// Report routes (protected)
	reports := api.Group("/reports", authRequired)
	reports.Get("/trends", reportHandler.Trends)
	reports.Get("/categories", reportHandler.Categories)
	reports.Get("/export", reportHandler.Export)

	// Account routes (protected)
	accounts := api.Group("/accounts", authRequired)
	accounts.Get("/", accountHandler.List)
	accounts.Post("/", accountHandler.Create)
	accounts.Post("/:id/balance", accountHandler.SetBalance)
	accounts.Put("/:id", accountHandler.Update)
	accounts.Delete("/:id", accountHandler.Delete)
}

// credentialLimiter caps guesses per client IP and email. Only failed attempts
// count, and a 4-digit PIN has just 10,000 combinations, so unthrottled
// guessing is trivial.
func credentialLimiter(max int, message string) fiber.Handler {
	return limiter.New(limiter.Config{
		Max:                    max,
		Expiration:             15 * time.Minute,
		SkipSuccessfulRequests: true,
		KeyGenerator: func(c *fiber.Ctx) string {
			var body struct {
				Email string `json:"email"`
			}
			_ = c.BodyParser(&body)
			return c.Path() + "|" + c.IP() + "|" + strings.ToLower(strings.TrimSpace(body.Email))
		},
		LimitReached: func(c *fiber.Ctx) error {
			return c.Status(fiber.StatusTooManyRequests).JSON(fiber.Map{
				"message": message,
			})
		},
	})
}

// socialLoginLimiter throttles Google/Apple sign-in per client IP. Each
// request costs a token verification and a database write.
func socialLoginLimiter() fiber.Handler {
	return limiter.New(limiter.Config{
		Max:        10,
		Expiration: time.Minute,
		LimitReached: func(c *fiber.Ctx) error {
			return c.Status(fiber.StatusTooManyRequests).JSON(fiber.Map{
				"message": "Too many sign-in attempts. Please try again in a minute.",
			})
		},
	})
}
