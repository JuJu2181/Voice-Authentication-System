const spawn = require("await-spawn");
const uploadFile = require("../middleware/upload");
const {
    loginValidation,
    registerValidation,
} = require("../imports/validation");
const User = require("../models/User");
const jwt = require("jsonwebtoken");
const response = require("../imports/response");

// environment
const config = require("../config.json");

const mutler = require("multer");
const fs = require("fs");
const { type } = require("os");
const upload = mutler({ dest: config.uploadRegisterDir });

const userRegisternew = async (req, res) => {
    console.log("Received file " + req.file.originalname);
    var fileName = req.file.originalname;
    var audioFile = config.uploadRegisterDir + "/" + fileName;
    var data = req.body;
    var src = fs.createReadStream(req.file.path);
    var dest = fs.createWriteStream(audioFile);
    src.pipe(dest); // audioFile contains data that was in req.file.path
    src.on("end", async () => {
        fs.unlinkSync(req.file.path);
        console.log("Making GMM for the new user");

        make_gmm_result = makeGmm(data.userName);
        speech_recognition_result = recognizeSpeech(
            data.userName,
            data.sentence,
            "register"
        );
        Promise.all([make_gmm_result, speech_recognition_result]).then(
            ([make_gmm_result, speech_recognition_result]) => {
                if (
                    make_gmm_result == "True" &&
                    speech_recognition_result == "True"
                ) {
                    console.log("Succeeded making GMM for the new user");
                    console.log("Succeeded verifying speech for the new user");

                    // Create new user
                    const user = new User({
                        userName: data.userName,
                        audioFile: fileName,
                    });
                    user.save()
                        .then((result) => {
                            console.log("saving user");
                            // create jwt token
                            var token = jwt.sign(
                                { _id: user._id },
                                config.token_key
                            );
                            return response.responseToken(
                                res,
                                response.status_ok,
                                response.code_ok,
                                null,
                                "success",
                                null,
                                token
                            );
                            // res.status(200).header('auth-token', token).json(successMessage("Successfully Registered"))
                        })
                        .catch((err) => {
                            console.log(err);
                            return response.response(
                                res,
                                response.status_fail,
                                response.code_failed,
                                err,
                                null,
                                null
                            );
                        });
                } else if (
                    make_gmm_result == "True" &&
                    speech_recognition_result == "False"
                ) {
                    err = "Failed verifying speech for the new user";
                    console.log("Something went wrong");
                    console.log(err);
                    return response.response(
                        res,
                        response.status_fail,
                        response.code_failed,
                        "Registration failed... Please read the passage carefully.",
                        null,
                        null
                    );
                } else if (
                    make_gmm_result == "error" ||
                    speech_recognition_result == "error"
                ) {
                    err = "Something went wrong";
                    console.log("Error running python script");
                    console.log(err);
                    return response.response(
                        res,
                        response.status_fail,
                        response.code_failed,
                        "Registration failed... Internal server error.",
                        null,
                        null
                    );
                } else if (
                    make_gmm_result == "False" &&
                    speech_recognition_result == "True"
                ) {
                    err = "Failed making gmm for the new user";
                    console.log("Something went wrong");
                    console.log(err);
                    return response.response(
                        res,
                        response.status_fail,
                        response.code_failed,
                        "Registration failed... Server error!!",
                        null,
                        null
                    );
                } else {
                    err =
                        "Failed verifying speech and making GMM for the new user";
                    console.log("Something went wrong");
                    console.log(err);
                    return response.response(
                        res,
                        response.status_fail,
                        response.code_failed,
                        "Registration failed...",
                        null,
                        null
                    );
                }
            }
        );
    });
    src.on("error", function (err) {
        console.log(err.message);
        res.json("Something went wrong!");
    });
    // console.log("hello world");
    console.log(req.body);
};

const userLoginnew = async (req, res) => {
    console.log("Received file " + req.file.originalname);
    var fileName = req.file.originalname;
    var audioFile = config.uploadLoginDir + "/" + fileName;
    var data = req.body;
    var src = fs.createReadStream(req.file.path);
    var dest = fs.createWriteStream(audioFile);
    src.pipe(dest);
    src.on("end", async () => {
        fs.unlinkSync(req.file.path);

        var data = req.body;
        // let audioFile = req.file.originalname;

        // validation
        let error = loginValidation(data);
        if (error) {
            return response.response(
                res,
                response.status_fail,
                response.code_failed,
                error["userName"],
                null,
                null
            );
        }

        // check user
        var user = await User.findOne({ userName: data.userName });
        if (!user)
            return response.response(
                res,
                response.status_fail,
                response.code_failed,
                "username not found",
                null,
                null
            );

        identification_result = identify(data.userName);
        speech_recognition_result = recognizeSpeech(
            data.userName,
            data.sentence,
            "login"
        );
        Promise.all([identification_result, speech_recognition_result]).then(
            ([identification_result, speech_recognition_result]) => {
                if (
                    identification_result == "True" &&
                    speech_recognition_result == "True"
                ) {
                    console.log("Identification successful");
                    console.log("Speech recognition successful");
                    // create jwt token and assign
                    var token = jwt.sign({ _id: user._id }, config.token_key);

                    return response.responseToken(
                        res,
                        response.status_ok,
                        response.code_ok,
                        null,
                        "success",
                        null,
                        token
                    );
                } else if (
                    identification_result == "True" &&
                    speech_recognition_result == "False"
                ) {
                    console.log("Identification passed");
                    console.log("Speech verification failed");
                    return response.response(
                        res,
                        response.status_fail,
                        response.code_failed,
                        "You did not read the text properly. Please try again...",
                        null,
                        null
                    );
                } else if (
                    identification_result == "False" &&
                    speech_recognition_result == "True"
                ) {
                    console.log("Identification failed");
                    console.log("Speech verification passed");
                    return response.response(
                        res,
                        response.status_fail,
                        response.code_failed,
                        `You are not ${data.userName}.`,
                        null,
                        null
                    );
                } else if (
                    identification_result == "error" ||
                    speech_recognition_result == "error"
                ) {
                    console.log("Something went wrong");
                    console.log("Error running python script");
                    return response.response(
                        res,
                        response.status_fail,
                        response.code_failed,
                        "Login failed... Internal server error.",
                        null,
                        null
                    );
                }else {
                    console.log("Speech verification failed");
                    console.log("Identification failed");
                    return response.response(
                        res,
                        response.status_fail,
                        response.code_failed,
                        `You are not ${data.userName}`,
                        null,
                        null
                    );
                }
            }
        );
    });
    src.on("error", function (err) {
        res.json("Something went wrong!");
    });
    console.log(req.body);
};

// const userRegister = async (req, res) => {
//     console.log("Registering");
//     try {
//         await uploadFile.registerUploadFileMiddleware(req, res);
//         // fileName = uploadFile.getFileName();
//         if (req.file == undefined) {
//             // return res.status(400).json(errorMessage("Please upload audio file"));
//             return response.response(
//                 res,
//                 response.status_fail,
//                 response.code_failed,
//                 "Please upload audio",
//                 null,
//                 null
//             );
//         }
//     } catch (err) {
//         return response.response(
//             res,
//             response.status_fail,
//             response.code_error,
//             err,
//             null,
//             null
//         );
//     }
//     console.log("file uploaded");
//     let data = req.body;

//     let audioFile = req.file.originalname;

//     // validation
//     let error = registerValidation(data);
//     if (error) {
//         return response.response(
//             res,
//             response.status_fail,
//             response.code_failed,
//             error,
//             null,
//             null
//         );
//     }

//     // checking if userName already exists
//     var userNameExists = await User.findOne({ userName: data.userName });
//     if (userNameExists)
//         return response.response(
//             res,
//             response.status_fail,
//             response.code_failed,
//             { userName: "userName already exists" },
//             null,
//             null
//         );

//     var fileExists = await User.findOne({ audioFile: audioFile });
//     if (fileExists)
//         return response.response(
//             res,
//             response.status_fail,
//             response.code_failed,
//             { audioFile: "audioFile already exists" },
//             null,
//             null
//         );

//     // create new user
//     const user = new User({
//         userName: data.userName,
//         audioFile: audioFile,
//     });

//     user.save()
//         .then((result) => {
//             console.log("saving user");
//             // create jwt token
//             var token = jwt.sign({ _id: user._id }, config.token_key);
//             return response.responseToken(
//                 res,
//                 response.status_ok,
//                 response.code_ok,
//                 null,
//                 "success",
//                 null,
//                 token
//             );
//             // res.status(200).header('auth-token', token).json(successMessage("Successfully Registered"))
//         })
//         .catch((err) => {
//             return response.response(
//                 res,
//                 response.status_fail,
//                 response.code_failed,
//                 err,
//                 null,
//                 null
//             );
//         });

//     // create token
//     // var token = jwt
// };

// const userLogin = async (req, res) => {
//     console.log("logging in");
//     try {
//         await uploadFile.loginUploadFileMiddleware(req, res);
//         audioFile = uploadFile.getFileName();
//         if (req.file == undefined) {
//             return response.response(
//                 res,
//                 response.status_fail,
//                 response.code_failed,
//                 "Please upload audio",
//                 null,
//                 null
//             );
//         }
//     } catch (err) {
//         return response.response(
//             res,
//             response.status_fail,
//             response.code_error,
//             err,
//             null,
//             null
//         );
//     }

//     var data = req.body;
//     // let audioFile = req.file.originalname;

//     // validation
//     let error = loginValidation(data);
//     if (error) {
//         return response.response(
//             res,
//             response.status_fail,
//             response.code_failed,
//             error,
//             null,
//             null
//         );
//     }

//     // check user
//     var user = await User.findOne({ userName: data.userName });
//     if (!user)
//         return response.response(
//             res,
//             response.status_fail,
//             response.code_failed,
//             { userName: "UserName not found" },
//             null,
//             null
//         );

//     // interaction with python module
//     const pythonProcess = spwan("python", [
//         "login.py",
//         user.userName,
//         user.audioFile,
//     ]);
//     await pythonProcess.stdout.on("data", (data) => {
//         pythonData = data.toString();
//         pythonData = JSON.parse(pythonData);
//         // console.log(pythonData)
//     });

//     await pythonProcess.on("close", (code) => {
//         console.log(`Child process closs all stdio with code: ${code}`);
//         if (!pythonData.isUser)
//             return response.response(
//                 res,
//                 response.status_fail,
//                 response.code_failed,
//                 "You are an imposter",
//                 null,
//                 null
//             );
//         // create jwt token and assign
//         var token = jwt.sign({ _id: user._id }, config.token_key);

//         return response.responseToken(
//             res,
//             response.status_ok,
//             response.code_ok,
//             null,
//             "success",
//             null,
//             token
//         );
//     });
// };

const getUserInfoFromToken = async (req, res) => {
    var userId = req.user._id;
    var usersProjection = {
        _id: 1,
        userName: 1,
    };
    User.findById(userId, usersProjection)
        .then((data) => {
            return response.response(
                res,
                response.status_ok,
                response.code_ok,
                null,
                "success",
                data
            );
        })
        .catch((err) => {
            return response.response(
                res,
                response.status_fail,
                response.code_ok,
                "Error",
                null,
                null
            );
        });
};

const getUsers = async (req, res) => {
    console.log("Getting all users");
    var usersProjection = {
        _id: 1,
        userName: 1,
    };
    User.find({}, usersProjection)
        .then((data) => {
            return response.response(
                res,
                response.status_ok,
                response.code_ok,
                null,
                "success",
                data
            );
        })
        .catch((err) => {
            return response.response(
                res,
                response.status_fail,
                response.code_failed,
                err,
                null,
                null
            );
        });
};

const recognizeSpeech = async (username, sentence, speechType) => {
    console.log(sentence);
    console.log("Recognizing Speech");
    try {
        const pythonProcessforSR = await spawn("python", [
            "../speechrecognition.py",
            username,
            sentence,
            speechType,
        ]);
        const data = pythonProcessforSR.toString().split("\n").pop();
        console.log(data);
        return data;
    } catch (error) {
        console.log("Something went wrong.");
        return "error";
    }
};

const makeGmm = async (username) => {
    console.log("making gmm");
    try {
        data = await spawn("python", ["../make_gmm.py", username]);
        data = data.toString();
        console.log(data);
        const result = data.split("\n").pop();
        console.log("result is ", result);
        return result;
    } catch (error) {
        console.log("Something went wrong.");
        return "error";
    }
};

const identify = async (username) => {
    try {
        const pythonProcess = await spawn("python", [
            "../identify.py",
            username,
        ]);
        console.log(pythonProcess.toString());
        const pythonData = pythonProcess.toString().split("\n").pop();
        return pythonData;
    } catch (error) {
        console.log("Something went wrong.");
        return "error";
    }
};

module.exports = {
    // userRegister,
    // userLogin,
    getUsers,
    userRegisternew,
    userLoginnew,
    getUserInfoFromToken,
};
