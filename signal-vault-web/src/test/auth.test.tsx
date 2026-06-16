import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// ── Mock the API client ────────────────────────────────────────────────────────

const mockApiLogin = vi.fn();
const mockApiRefresh = vi.fn();
const mockApiRegister = vi.fn();
const mockApiLogout = vi.fn();
const mockApiMe = vi.fn();
const mockSetAccessToken = vi.fn();
const mockGetAccessToken = vi.fn(() => null);
const mockSetOnSessionExpired = vi.fn();

vi.mock("@/lib/api/client", () => ({
  apiLogin: (...args: unknown[]) => mockApiLogin(...args),
  apiRefresh: (...args: unknown[]) => mockApiRefresh(...args),
  apiRegister: (...args: unknown[]) => mockApiRegister(...args),
  apiLogout: (...args: unknown[]) => mockApiLogout(...args),
  apiMe: (...args: unknown[]) => mockApiMe(...args),
  setAccessToken: (...args: unknown[]) => mockSetAccessToken(...args),
  getAccessToken: () => mockGetAccessToken(),
  setOnSessionExpired: (...args: unknown[]) => mockSetOnSessionExpired(...args),
  ApiError: class ApiError extends Error {
    status: number;
    constructor(status: number, message: string) {
      super(message);
      this.status = status;
      this.name = "ApiError";
    }
  },
}));

// ── Import after mock ─────────────────────────────────────────────────────────

import { AuthProvider, useAuth } from "@/lib/auth/AuthProvider";

// ── Test component ────────────────────────────────────────────────────────────

function TestConsumer() {
  const { status, user, login, logout } = useAuth();
  return (
    <div>
      <p data-testid="status">{status}</p>
      <p data-testid="email">{user?.email ?? "none"}</p>
      <button onClick={() => login("test@example.com", "password123")}>
        Login
      </button>
      <button onClick={() => logout()}>Logout</button>
    </div>
  );
}

function renderWithAuth() {
  return render(
    <AuthProvider>
      <TestConsumer />
    </AuthProvider>
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  // Default: refresh fails (no session)
  mockApiRefresh.mockRejectedValue(new Error("No session"));
});

describe("AuthProvider", () => {
  it("shows loading then unauthenticated when refresh fails", async () => {
    renderWithAuth();
    expect(screen.getByTestId("status").textContent).toBe("loading");
    await waitFor(() =>
      expect(screen.getByTestId("status").textContent).toBe("unauthenticated")
    );
  });

  it("shows authenticated with user after successful login", async () => {
    mockApiRefresh.mockRejectedValue(new Error("No session"));
    const user = userEvent.setup();
    renderWithAuth();

    // Wait for initial load
    await waitFor(() =>
      expect(screen.getByTestId("status").textContent).toBe("unauthenticated")
    );

    // Mock login
    mockApiLogin.mockResolvedValue({
      accessToken: "tok123",
      expiresIn: 900,
      user: { id: "u1", email: "test@example.com", createdAt: "2026-01-01" },
    });

    await act(async () => {
      await user.click(screen.getByText("Login"));
    });

    await waitFor(() =>
      expect(screen.getByTestId("status").textContent).toBe("authenticated")
    );
    expect(screen.getByTestId("email").textContent).toBe("test@example.com");
    expect(mockSetAccessToken).toHaveBeenCalledWith("tok123");
  });

  it("rehidrates session when refresh succeeds on mount", async () => {
    mockApiRefresh.mockResolvedValue({
      accessToken: "refresh-tok",
      expiresIn: 900,
    });
    mockApiMe.mockResolvedValue({
      id: "u2",
      email: "restored@example.com",
      createdAt: "2026-01-01",
    });

    renderWithAuth();

    await waitFor(() =>
      expect(screen.getByTestId("status").textContent).toBe("authenticated")
    );
    expect(screen.getByTestId("email").textContent).toBe("restored@example.com");
  });

  it("clears session on logout", async () => {
    mockApiRefresh.mockResolvedValue({
      accessToken: "tok",
      expiresIn: 900,
    });
    mockApiMe.mockResolvedValue({
      id: "u3",
      email: "logout@example.com",
      createdAt: "2026-01-01",
    });
    mockApiLogout.mockResolvedValue(undefined);

    const user = userEvent.setup();
    renderWithAuth();

    await waitFor(() =>
      expect(screen.getByTestId("status").textContent).toBe("authenticated")
    );

    await act(async () => {
      await user.click(screen.getByText("Logout"));
    });

    await waitFor(() =>
      expect(screen.getByTestId("status").textContent).toBe("unauthenticated")
    );
    expect(screen.getByTestId("email").textContent).toBe("none");
  });
});
