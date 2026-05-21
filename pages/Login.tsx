import React, { useState, useEffect } from "react";
import {
  Mail,
  Lock,
  User,
  ArrowLeft,
  Eye,
  EyeOff,
  Loader2,
  Moon,
  Sun,
  Check,
  RefreshCw,
} from "lucide-react";
import { Role } from "../types";
import fti from "../src/assets/Gedung.jpg";
import nocLogo from "../src/assets/NOC.svg";
import { api } from "../services/api";
import { CLIENT_ID } from "../src/config/google";
import { APP_VERSION, APP_NAME, APP_FULL_NAME, INSTITUTION_NAME} from "../config";

declare global {
  interface Window {
    google: any;
  }
}

interface LoginProps {
  onLogin: (role: Role, userName?: string, rememberMe?: boolean, userEmail?: string) => void;
  showToast: (
    message: string | React.ReactNode,
    type: "success" | "error" | "info" | "warning",
    sticky?: boolean,
  ) => void;
  isDarkMode: boolean;
  toggleDarkMode: () => void;
}

type ViewState = "login" | "register" | "forgot-password" | "set-password";
type PasswordVisibilityField =
  | "login"
  | "register"
  | "registerConfirm"
  | "setPassword"
  | "setPasswordConfirm";

const Login: React.FC<LoginProps> = ({
  onLogin,
  showToast,
  isDarkMode,
  toggleDarkMode,
}) => {
  const defaultPasswordVisibility = {
    login: false,
    register: false,
    registerConfirm: false,
    setPassword: false,
    setPasswordConfirm: false,
  };
  const [view, setView] = useState<ViewState>("login");
  const [isLoading, setIsLoading] = useState(false);
  const [passwordVisibility, setPasswordVisibility] = useState(defaultPasswordVisibility);
  const [rememberMe, setRememberMe] = useState(false);
  const [ssoEnabled, setSsoEnabled] = useState(true);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    email: "",
    username: "", // New Field for Register
    password: "",
    confirmPassword: "",
    fullName: "",
    nim: "",
    resetToken: "",
  });

  // CAPTCHA State
  const [captcha, setCaptcha] = useState({ num1: 0, num2: 0, answer: 0 });
  const [captchaInput, setCaptchaInput] = useState("");

  const generateCaptcha = () => {
    const num1 = Math.floor(Math.random() * 10);
    const num2 = Math.floor(Math.random() * 10);
    setCaptcha({ num1, num2, answer: num1 + num2 });
    setCaptchaInput("");
  };

  useEffect(() => {
    if (view === "forgot-password") {
      generateCaptcha();
    }
  }, [view]);

  useEffect(() => {
    const savedEmail = localStorage.getItem("rememberedEmail");
    if (savedEmail) {
      setFormData((prev) => ({ ...prev, email: savedEmail }));
      setRememberMe(true);
    }
  }, []);

  // Fetch SSO config on mount
  useEffect(() => {
    const fetchSsoConfig = async () => {
      try {
        const res = await api("/api/settings/sso-config");
        if (res.ok) {
          const data = await res.json();
          setSsoEnabled(data.enabled ?? true);
        }
      } catch (err) {
        // Silent fail
      }
    };
    fetchSsoConfig();
  }, []);

  // Load Google Script
  useEffect(() => {
    if (ssoEnabled && typeof window.google === 'undefined') {
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      document.body.appendChild(script);
    }
  }, [ssoEnabled]);

  // Function to get Device ID
  const getDeviceId = () => {
    return localStorage.getItem("deviceId") || `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    const nextValue = name === "resetToken" ? value.toUpperCase().replace(/\s+/g, "") : value;
    setFormData({ ...formData, [name]: nextValue });
  };

  const changeView = (nextView: ViewState, overrides?: Partial<typeof formData>) => {
    setPasswordVisibility(defaultPasswordVisibility);
    setFormData((prev) => ({
      ...prev,
      password: "",
      confirmPassword: "",
      resetToken: "",
      ...overrides,
    }));
    setView(nextView);
  };

  const togglePasswordVisibility = (field: PasswordVisibilityField) => {
    setPasswordVisibility((prev) => ({
      ...prev,
      [field]: !prev[field],
    }));
  };

  const getPasswordStrength = (password: string) => {
    if (!password) return { label: "", color: "" };
    if (password.length < 8)
      return { label: "Terlalu Pendek", color: "text-red-500" };

    let score = 0;
    if (/[A-Z]/.test(password)) score++;
    if (/[a-z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;

    if (score <= 2) return { label: "Weak", color: "text-red-500" };
    if (score === 3) return { label: "Medium", color: "text-yellow-500" };
    return { label: "Strong", color: "text-green-500" };
  };

  const getActiveStorage = () => rememberMe ? localStorage : sessionStorage;
  const clearStoredAuth = () => {
    const authKeys = [
      "isAuthenticated",
      "currentRole",
      "userName",
      "userEmail",
      "authToken",
      "userId",
      "refreshToken",
    ];

    authKeys.forEach((key) => {
      localStorage.removeItem(key);
      sessionStorage.removeItem(key);
    });
  };

  const handleManualLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.email) {
      showToast("Mohon isi email atau username.", "error");
      return;
    }

    setIsLoading(true);

    try {
      let deviceId = getDeviceId();
      if (!localStorage.getItem("deviceId")) localStorage.setItem("deviceId", deviceId);

      const response = await api("/api/login", {
        method: "POST",
        data: {
          email: formData.email,
          password: formData.password || "",
          rememberMe: rememberMe,
          deviceId: deviceId,
        },
      });

      const data = await response.json();

      if (data.resetRequired) {
        showToast(
          `Halo ${data.name}, masukkan token reset dari admin untuk membuat password baru.`,
          "info",
        );
        changeView("set-password", { email: data.email });
        return;
      }

      if (response.ok && data.success) {
        const activeStorage = getActiveStorage();
        clearStoredAuth();
        activeStorage.setItem("authToken", data.token);
        activeStorage.setItem("userId", data.id);
        activeStorage.setItem("userName", data.name);
        activeStorage.setItem("userEmail", data.email);

        if (data.deviceId) {
          localStorage.setItem("deviceId", data.deviceId);
        }

        if (data.refreshToken) {
          activeStorage.setItem("refreshToken", data.refreshToken);
        }
        if (rememberMe) {
          localStorage.setItem("rememberedEmail", formData.email);
        } else {
          localStorage.removeItem("rememberedEmail");
        }

        if (data.profileIncomplete) {
          showToast(
            `Halo ${data.name}, yuk lengkapi data profil Anda (No. HP & Prodi) agar memudahkan administrasi.`,
            "info",
          );
        }

        onLogin(data.role as Role, data.name, rememberMe, data.email);
      } else {
        showToast(data.error || "Login gagal.", "error");
      }
    } catch (error) {
      showToast("Gagal terhubung ke server.", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validasi kekuatan password
    if (formData.password.length < 8) {
      showToast("Password harus minimal 8 karakter.", "error");
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      showToast("Password dan konfirmasi password tidak cocok!", "error");
      return;
    }

    if (/\s/.test(formData.username)) {
      showToast("Username tidak boleh mengandung spasi.", "error");
      return;
    }

    setIsLoading(true);

    try {
      const response = await api("/api/register", {
        method: "POST",
        data: {
          fullName: formData.fullName,
          nim: formData.nim,
          email: formData.email,
          username: formData.username,
          password: formData.password,
        },
      });

      const data = await response.json();

      if (response.ok && data.success) {
        showToast(
          "Akun berhasil dibuat! Menunggu persetujuan Admin.",
          "success",
        );
        changeView("login");
      } else {
        showToast(data.error || "Registrasi gagal.", "error");
      }
    } catch (error) {
      showToast("Gagal terhubung ke server.", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (parseInt(captchaInput) !== captcha.answer) {
      showToast("Verifikasi keamanan salah. Silakan coba lagi.", "error");
      generateCaptcha();
      return;
    }

    if (!formData.email) {
      showToast("Mohon masukkan alamat email anda.", "warning");
      return;
    }

    setIsLoading(true);
    try {
      const response = await api("/api/check-user-exists", {
        method: "POST",
        data: { identifier: formData.email },
      });
      const data = await response.json();

      if (data.exists) {
        // Tampilkan pesan instruksi hubungi admin jika user ditemukan
        showToast(
          <span>
            Halo <b>{data.name}</b>. Silakan hubungi Admin (
            <a
              href="mailto:fti.laboran@adm.uksw.edu"
              className="underline font-bold hover:text-blue-600 dark:hover:text-blue-400"
            >
              fti.laboran@adm.uksw.edu
            </a>
            ) untuk reset password.
          </span>,
          "info",
          true,
        );
        changeView("login");
      } else {
        showToast("Email atau Username tidak terdaftar dalam sistem.", "error");
      }
    } catch (error) {
      showToast("Gagal memverifikasi data.", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSetNewPassword = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validasi kekuatan password
    if (formData.password.length < 8) {
      showToast("Password harus minimal 8 karakter.", "error");
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      showToast("Password dan konfirmasi tidak cocok!", "error");
      return;
    }

    setIsLoading(true);
    try {
      const response = await api("/api/set-password", {
        method: "POST",
        data: {
          email: formData.email,
          newPassword: formData.password,
          resetToken: formData.resetToken,
        },
      });
      const data = await response.json();
      if (response.ok) {
        showToast(data.message, "success");
        changeView("login");
      } else {
        showToast(data.error || "Gagal mengatur password.", "error");
      }
    } catch (error) {
      showToast("Terjadi kesalahan koneksi.", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const setPasswordStrength = getPasswordStrength(formData.password);
  const setPasswordMismatch =
    formData.confirmPassword.length > 0 &&
    formData.password !== formData.confirmPassword;
  const isSetPasswordSubmitDisabled =
    isLoading ||
    !formData.resetToken.trim() ||
    formData.password.length < 8 ||
    !formData.confirmPassword ||
    setPasswordMismatch;

  const handleGoogleLogin = () => {
    if (!window.google) {
      showToast("Google Services belum siap. Coba refresh halaman.", "warning");
      return;
    }

    setIsGoogleLoading(true);

    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: 'https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile',
      callback: async (tokenResponse: any) => {
        if (tokenResponse && tokenResponse.access_token) {
          try {
            // Send Access Token to Backend
            const deviceId = getDeviceId();
            if (!localStorage.getItem("deviceId")) localStorage.setItem("deviceId", deviceId);

            const res = await api('/api/auth/google', {
              method: 'POST',
              data: { 
                accessToken: tokenResponse.access_token,
                deviceId: deviceId,
                rememberMe: rememberMe
              }
            });

            const data = await res.json();

            if (res.ok && data.success) {
               const activeStorage = getActiveStorage();
               clearStoredAuth();
               activeStorage.setItem("authToken", data.token);
               activeStorage.setItem("userId", data.id);
               activeStorage.setItem("userName", data.name);
               activeStorage.setItem("userEmail", data.email);
               
               if (data.deviceId) {
                 localStorage.setItem("deviceId", data.deviceId);
               } else if (!localStorage.getItem("deviceId")) {
                 localStorage.setItem("deviceId", deviceId);
               }

               if (data.refreshToken) {
                 activeStorage.setItem("refreshToken", data.refreshToken);
               }

               if (rememberMe) {
                 localStorage.setItem("rememberedEmail", data.email);
               } else {
                 localStorage.removeItem("rememberedEmail");
               }
               
               showToast(`Login berhasil sebagai ${data.name}`, "success");
               onLogin(data.role as Role, data.name, rememberMe, data.email);
            } else {
               const errorMessage = data.details ? `${data.error} - ${data.details}` : data.error;
               showToast(errorMessage || "Gagal login dengan Google.", "error");
            }
          } catch (err) {
            showToast("Gagal memproses login Google di server.", "error");
          }
        }
        setIsGoogleLoading(false);
      },
    });

    client.requestAccessToken();
  };

  return (
    <div className="relative flex min-h-screen flex-col bg-gray-50 font-sans dark:bg-gray-950 lg:flex-row">
      {/* Dark Mode Toggle */}
      <button
        onClick={toggleDarkMode}
        className="absolute right-4 top-4 z-50 rounded-full bg-white/25 p-2.5 text-gray-800 backdrop-blur-sm hover:bg-white/35 dark:text-white lg:bg-black/20 lg:text-white"
        title={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
      >
        {isDarkMode ? (
          <Sun className="w-6 h-6" />
        ) : (
          <Moon className="w-6 h-6" />
        )}
      </button>

      {/* Left Side - Branding & Image */}
      <div className="relative flex overflow-hidden bg-linear-to-br from-sky-700 via-blue-700 to-slate-900 px-6 py-8 text-white sm:px-10 sm:py-10 lg:w-[52%] lg:px-12 lg:py-12 dark:from-sky-900 dark:via-blue-950 dark:to-slate-950">
        {/* Animated Background */}
        <div
          className="absolute inset-0 scale-110 bg-cover bg-center opacity-20 mix-blend-overlay animate-bg-pan"
          style={{ backgroundImage: `url(${fti})` }}
        ></div>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.16),transparent_32%)]"></div>

        <div className="relative z-10 flex min-h-full flex-col justify-between gap-12">
          <div className="max-w-xl">
            <div className="mb-8 inline-flex items-center gap-3 rounded-full border border-white/15 bg-white/10 px-4 py-2 backdrop-blur-sm">
            <img
              src={nocLogo}
              alt="NOC Logo"
              className="h-12 w-12 object-contain sm:h-14 sm:w-14"
            />
              <div>
                <p className="font-brand text-2xl font-bold tracking-tight sm:text-3xl">{APP_NAME} - UKSW</p>
                <p className="text-xs font-medium uppercase tracking-[0.22em] text-blue-100/90">{APP_FULL_NAME}</p>
              </div>
            </div>
            <h1 className="max-w-lg text-4xl font-bold leading-[1.05] text-white sm:text-5xl lg:text-6xl">
              Platform manajemen sarpras dan layanan administrasi yang terintegrasi.
            </h1>
            <p className="mt-5 max-w-md text-base leading-7 text-blue-100 sm:text-lg">
              Kelola ruangan, inventaris, jadwal, dan layanan administrasi FTI UKSW dari satu web app.
            </p>
          </div>
          <div className="grid max-w-xl gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur-sm">
              <p className="text-xs uppercase tracking-[0.16em] text-blue-100/80">Ruangan</p>
              <p className="mt-2 text-lg font-semibold">Detail ruangan lengkap</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur-sm">
              <p className="text-xs uppercase tracking-[0.16em] text-blue-100/80">Inventaris</p>
              <p className="mt-2 text-lg font-semibold">Aset milik FTI UKSW</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur-sm">
              <p className="text-xs uppercase tracking-[0.16em] text-blue-100/80">Layanan</p>
              <p className="mt-2 text-lg font-semibold">Akses lebih cepat</p>
            </div>
          </div>

          <div className="text-sm text-blue-100/80">
            &copy; {new Date().getFullYear()} Sarana dan Prasarana {INSTITUTION_NAME}. All rights reserved.
          </div>
        </div>
      </div>

      {/* Right Side - Forms */}
      <div className="relative flex items-center justify-center bg-white px-5 py-8 text-gray-900 transition-colors dark:bg-gray-900 dark:text-white sm:px-6 lg:w-[48%] lg:px-10">
        <div className="w-full max-w-lg rounded-[2rem] border border-gray-200 bg-white p-6 shadow-[0_24px_80px_rgba(15,23,42,0.08)] dark:border-gray-800 dark:bg-gray-900 sm:p-8">
          {view === "login" && (
            <div className="animate-fade-in-up">
              <div className="mb-8 text-center">
                <h2 className="text-3xl font-extrabold text-gray-900 dark:text-white sm:text-4xl">
                  Selamat Datang
                </h2>
                <p className="mt-3 text-sm leading-6 text-gray-600 dark:text-gray-400">
                  Masuk untuk mengakses layanan CORE.FTI
                </p>
              </div>

              <form onSubmit={handleManualLogin} className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Email / Username
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Mail className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      name="email"
                      type="text"
                      required
                      value={formData.email}
                      onChange={handleChange}
                      className="block w-full rounded-xl border border-gray-300 py-3 pl-10 pr-3 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
                      placeholder="Email atau Username"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Password
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Lock className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      name="password"
                      type={passwordVisibility.login ? "text" : "password"}
                      // required -> Dihapus agar user bisa submit kosong saat mode reset
                      value={formData.password}
                      onChange={handleChange}
                      className="block w-full rounded-xl border border-gray-300 py-3 pl-10 pr-10 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => togglePasswordVisibility("login")}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                      aria-label={passwordVisibility.login ? "Sembunyikan password" : "Tampilkan password"}
                    >
                      {passwordVisibility.login ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center">
                    <input
                      id="remember-me"
                      name="remember-me"
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 dark:border-gray-600 rounded"
                    />
                    <label
                      htmlFor="remember-me"
                      className="ml-2 block text-sm text-gray-900 dark:text-gray-300"
                    >
                      Ingat Saya
                    </label>
                  </div>

                  <div className="text-sm">
                    <button
                      type="button"
                      onClick={() => changeView("forgot-password")}
                      className="font-medium text-blue-600 hover:text-blue-500"
                    >
                      Lupa Password?
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex w-full justify-center rounded-xl border border-transparent bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-70"
                >
                  {isLoading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    "Masuk"
                  )}
                </button>
              </form>

              <div className="mt-6">
                {ssoEnabled && (
                  <>
                    <div className="relative">
                      <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-gray-300 dark:border-gray-600"></div>
                      </div>
                      <div className="relative flex justify-center text-sm">
                        <span className="px-2 bg-white dark:bg-gray-800 text-gray-500">
                          atau lanjutkan dengan
                        </span>
                      </div>
                    </div>

                    <div className="mt-6">
                      <button
                        type="button"
                        onClick={handleGoogleLogin}
                        className="flex w-full items-center justify-center rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50 disabled:opacity-70 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
                      >
                        <svg
                          className="h-5 w-5 mr-3"
                          aria-hidden="true"
                          viewBox="0 0 24 24"
                        >
                          <path
                            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                            fill="#4285F4"
                          />
                          <path
                            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                            fill="#34A853"
                          />
                          <path
                            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                            fill="#FBBC05"
                          />
                          <path
                            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                            fill="#EA4335"
                          />
                        </svg>
                        {isGoogleLoading ? 'Menghubungkan...' : 'Google Workspace'}
                      </button>
                    </div>
                  </>
                )}
              </div>

              <p className="mt-8 text-center text-sm text-gray-600 dark:text-gray-400">
                Belum punya akun?{" "}
                <button
                  onClick={() => changeView("register")}
                  className="font-medium text-blue-600 hover:text-blue-500"
                >
                  Buat akun baru
                </button>
              </p>
            </div>
          )}

          {view === "register" && (
            <div className="animate-fade-in-up">
              <button
                onClick={() => changeView("login")}
                className="flex items-center text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 mb-6 transition-colors"
              >
                <ArrowLeft className="w-4 h-4 mr-1" /> Kembali ke Login
              </button>

              <div className="mb-8">
                <h2 className="text-3xl font-extrabold text-gray-900 dark:text-white sm:text-4xl">
                  Buat Akun
                </h2>
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                  Daftar untuk mengakses sistem
                </p>
              </div>

              <form onSubmit={handleRegister} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Nama Lengkap
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <User className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      name="fullName"
                      type="text"
                      required
                      onChange={handleChange}
                      className="block w-full pl-10 px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white sm:text-sm placeholder-gray-400 dark:placeholder-gray-400"
                      placeholder="John Doe"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    NIM / NIDN
                  </label>
                  <input
                    name="nim"
                    type="text"
                    required
                    onChange={handleChange}
                    className="block w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white sm:text-sm placeholder-gray-400 dark:placeholder-gray-400"
                    placeholder="682026xxx"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Email
                  </label>
                  <input
                    name="email"
                    type="email"
                    required
                    onChange={handleChange}
                    className="block w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white sm:text-sm placeholder-gray-400 dark:placeholder-gray-400"
                    placeholder="nim@student.uksw.edu"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Username
                  </label>
                  <input
                    name="username"
                    type="text"
                    required
                    onChange={handleChange}
                    className="block w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white sm:text-sm placeholder-gray-400 dark:placeholder-gray-400"
                    placeholder="Username unik"
                  />
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Password
                    </label>
                    <div className="relative">
                      <input
                        name="password"
                        type={passwordVisibility.register ? "text" : "password"}
                        required
                        onChange={handleChange}
                        className="block w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white sm:text-sm pr-10 placeholder-gray-400 dark:placeholder-gray-400"
                        placeholder="••••••••"
                      />
                      <button
                        type="button"
                        onClick={() => togglePasswordVisibility("register")}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                        aria-label={passwordVisibility.register ? "Sembunyikan password" : "Tampilkan password"}
                      >
                        {passwordVisibility.register ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                    {formData.password && (
                      <div className="mt-1 text-xs text-right">
                        Strength:{" "}
                        <span
                          className={`font-bold ${getPasswordStrength(formData.password).color}`}
                        >
                          {getPasswordStrength(formData.password).label}
                        </span>
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Konfirmasi
                    </label>
                    <div className="relative">
                      <input
                        name="confirmPassword"
                        type={passwordVisibility.registerConfirm ? "text" : "password"}
                        required
                        onChange={handleChange}
                        className={`block w-full px-3 py-2.5 border ${formData.confirmPassword && formData.password !== formData.confirmPassword ? "border-red-500 focus:border-red-500 focus:ring-red-500" : "border-gray-300 dark:border-gray-600 focus:ring-blue-500 focus:border-blue-500"} rounded-lg dark:bg-gray-700 dark:text-white sm:text-sm pr-10 placeholder-gray-400 dark:placeholder-gray-400`}
                        placeholder="••••••••"
                      />
                      <button
                        type="button"
                        onClick={() => togglePasswordVisibility("registerConfirm")}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                        aria-label={passwordVisibility.registerConfirm ? "Sembunyikan password" : "Tampilkan password"}
                      >
                        {passwordVisibility.registerConfirm ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                    {formData.confirmPassword &&
                      formData.password !== formData.confirmPassword && (
                        <p className="mt-1 text-xs text-red-500">
                          Password tidak cocok
                        </p>
                      )}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={
                    isLoading || formData.password !== formData.confirmPassword
                  }
                  className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-70 disabled:cursor-not-allowed mt-4 transition-colors"
                >
                  {isLoading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    "Daftar Sekarang"
                  )}
                </button>
              </form>
            </div>
          )}

          {view === "forgot-password" && (
            <div className="animate-fade-in-up">
              <button
                onClick={() => changeView("login")}
                className="flex items-center text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 mb-6 transition-colors"
              >
                <ArrowLeft className="w-4 h-4 mr-1" /> Kembali ke Login
              </button>

              <div className="mb-8">
                <h2 className="text-3xl font-extrabold text-gray-900 dark:text-white sm:text-4xl">
                  Lupa Password?
                </h2>
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                  Masukkan email anda untuk mereset password
                </p>
              </div>

              <form onSubmit={handleForgotPassword} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Email
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Mail className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      name="email"
                      type="text"
                      required
                      onChange={handleChange}
                      className="block w-full pl-10 px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white sm:text-sm placeholder-gray-400 dark:placeholder-gray-400"
                      placeholder="nama@uksw.edu"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Verifikasi Keamanan
                  </label>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <div className="shrink-0 bg-gray-100 dark:bg-gray-700 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 font-mono text-lg font-bold tracking-widest select-none text-gray-800 dark:text-gray-200">
                      {captcha.num1} + {captcha.num2} = ?
                    </div>
                    <button
                      type="button"
                      onClick={generateCaptcha}
                      className="p-2 text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 transition-colors"
                      title="Refresh CAPTCHA"
                    >
                      <RefreshCw className="w-5 h-5" />
                    </button>
                  </div>
                  <input
                    type="number"
                    required
                    value={captchaInput}
                    onChange={(e) => setCaptchaInput(e.target.value)}
                    className="mt-2 block w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white sm:text-sm placeholder-gray-400 dark:placeholder-gray-400"
                    placeholder="Hasil penjumlahan"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-70 transition-colors"
                >
                  {isLoading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    "Cek Akun"
                  )}
                </button>
              </form>
            </div>
          )}

          {view === "set-password" && (
            <div className="animate-fade-in-up">
              <button
                onClick={() => changeView("login")}
                className="mb-6 flex items-center text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 transition-colors"
              >
                <ArrowLeft className="w-4 h-4 mr-1" /> Kembali ke Login
              </button>

              <div className="mb-8">
                <h2 className="text-3xl font-extrabold text-gray-900 dark:text-white sm:text-4xl">
                  Buat Password Baru
                </h2>
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                  Akun:{" "}
                  <span className="font-bold text-blue-600">
                    {formData.email}
                  </span>
                </p>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Gunakan token reset yang dibagikan admin. Token berlaku terbatas.
                </p>
              </div>

              <form onSubmit={handleSetNewPassword} className="space-y-5">
                <div className="rounded-2xl border border-blue-100 bg-blue-50/70 px-4 py-3 text-sm text-blue-900 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-100">
                  Masukkan token reset dari admin, lalu buat password minimal 8 karakter agar akun bisa dipakai login lagi.
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Token Reset
                  </label>
                  <input
                    name="resetToken"
                    type="text"
                    required
                    value={formData.resetToken}
                    onChange={handleChange}
                    className="block w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white sm:text-sm font-mono uppercase tracking-[0.2em] placeholder-gray-400 dark:placeholder-gray-400"
                    placeholder="AB12CD34EF56GH78"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Password Baru
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Lock className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      name="password"
                      type={passwordVisibility.setPassword ? "text" : "password"}
                      required
                      value={formData.password}
                      onChange={handleChange}
                      className="block w-full rounded-lg border border-gray-300 py-2.5 pl-10 pr-11 text-sm focus:ring-blue-500 focus:border-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white placeholder-gray-400 dark:placeholder-gray-400"
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => togglePasswordVisibility("setPassword")}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                      aria-label={passwordVisibility.setPassword ? "Sembunyikan password baru" : "Tampilkan password baru"}
                    >
                      {passwordVisibility.setPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                  {formData.password && (
                    <div className="mt-1 flex items-center justify-between gap-3 text-xs">
                      <span className="text-gray-500 dark:text-gray-400">
                        Gunakan kombinasi huruf besar, angka, dan simbol agar lebih aman.
                      </span>
                      <span className={`shrink-0 font-bold ${setPasswordStrength.color}`}>
                        {setPasswordStrength.label}
                      </span>
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Konfirmasi Password
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Check className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      name="confirmPassword"
                      type={passwordVisibility.setPasswordConfirm ? "text" : "password"}
                      required
                      value={formData.confirmPassword}
                      onChange={handleChange}
                      className={`block w-full rounded-lg py-2.5 pl-10 pr-11 text-sm dark:bg-gray-700 dark:text-white placeholder-gray-400 dark:placeholder-gray-400 ${
                        setPasswordMismatch
                          ? "border border-red-500 focus:ring-red-500 focus:border-red-500"
                          : "border border-gray-300 focus:ring-blue-500 focus:border-blue-500 dark:border-gray-600"
                      }`}
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => togglePasswordVisibility("setPasswordConfirm")}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                      aria-label={passwordVisibility.setPasswordConfirm ? "Sembunyikan konfirmasi password" : "Tampilkan konfirmasi password"}
                    >
                      {passwordVisibility.setPasswordConfirm ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                  {setPasswordMismatch ? (
                    <p className="mt-1 text-xs font-medium text-red-500">
                      Konfirmasi password belum sama dengan password baru.
                    </p>
                  ) : formData.confirmPassword ? (
                    <p className="mt-1 text-xs font-medium text-green-600 dark:text-green-400">
                      Konfirmasi password sudah cocok.
                    </p>
                  ) : null}
                </div>

                <button
                  type="submit"
                  disabled={isSetPasswordSubmitDisabled}
                  className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-70 transition-colors"
                >
                  {isLoading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    "Simpan Password & Login"
                  )}
                </button>
              </form>
            </div>
          )}

          {/* App Version */}
          <div className="absolute bottom-4 right-6 text-sm text-gray-400 dark:text-gray-600 tracking-wide select-none pointer-events-none">
            v{APP_VERSION}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
