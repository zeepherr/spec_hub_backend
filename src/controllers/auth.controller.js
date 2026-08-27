export const register = async (req, res, next) => {
  console.log("this is register route");
};

export const login = async (req, res, next) => {
  console.log("this is login routes");
};

export const refresh = async (req, res, next) => {
  console.log("this is refresh routes");
};

export const logout = async (req, res, next) => {
  console.log("this is logout route");
};

export const getMe = async (req, res, next) => {
  console.log("This is get me route");
};

export const verifyEmail = async (req, res, next) => {
  console.log("This is verify email route");
};

export const resendEmailOtp = async (req, res, next) => {
  console.log("This is resendEmailOtp route");
};

//                   REGISTER
//                      │
//          Email + Password
//                      ↓
//                     OTP
//                      ↓
//               Verify Email
//                      ↓
//                 Create User
//                      │
//                      │
//           ┌──────────┴──────────┐
//           │                     │
//           ↓                     ↓
//  Email + Password Login    Google Login
//           │                     │
//           │              Verify Google
//           │                     ↓
//           │              Find EXISTING User
//           │                     │
//           └──────────┬──────────┘
//                      ↓
//               createSession()
//                      ↓
//               Access Token
//               Refresh Token
//                      ↓
//                  Dashboard
