// AuthRouter.swift
//
// NavigationStack host for the unauthenticated phase. Mirrors RN's
// `app/(auth)/_layout.tsx` Stack — the four screens (login / email-login /
// signup / forgot-password) share a single stack with hidden chrome.
//
// Each leaf screen pushes via `path.append(.<route>)`; back gestures pop
// the stack and `dismiss()` works because we use `navigationDestination`.

import SwiftUI
import WagerproofDesign
import WagerproofStores

/// All routes inside the unauthenticated stack. The enum cases mirror the
/// RN file names so a reviewer can grep across both code-bases.
enum AuthRoute: Hashable {
    case emailLogin
    case signup
    case forgotPassword
}

struct AuthRouter: View {
    @State private var path: [AuthRoute] = []

    var body: some View {
        NavigationStack(path: $path) {
            LoginView()
                .navigationDestination(for: AuthRoute.self) { route in
                    switch route {
                    case .emailLogin:
                        EmailLoginView()
                    case .signup:
                        SignupView()
                    case .forgotPassword:
                        ForgotPasswordView()
                    }
                }
        }
        // Auth screens are always dark — matches the RN `StatusBar style="light"`
        // + black backgrounds on every (auth) screen.
        .preferredColorScheme(.dark)
        .tint(.white)
    }
}
