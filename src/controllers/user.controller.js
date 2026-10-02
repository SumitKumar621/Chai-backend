import { asynchandler } from "../utils/async-handler.js";
import { Apierror } from "../utils/Apierror.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { Apiresponse } from "../utils/Apiresponse.js";

const generateAccessAndRefereshTokens = async(userId) =>{
    try {
        const user = await User.findById(userId)
        const accessToken = user.generateAccessToken()
        const refreshToken = user.generateRefreshToken()

        user.refreshToken = refreshToken
        await user.save({ validateBeforeSave: false })

        return {accessToken, refreshToken}


    } catch (error) {
        throw new ApiError(500, "Something went wrong while generating referesh and access token")
    }
}


const registerUser = asynchandler( async (req,res) => {
    //GET USER DETAILS FROM FRONTEND
    //VALIDATION - NOT EMPTY
    //CHECK IF USER ALREADY EXITS : CHECK BY USERNAME AND EMAIL
    //CHECK FOR IMAGES,CHECK FOR AVATAR
    //UPLOAD THEM TO CLOUDINARY, CHECK FOR AVATAR
    //CREATE USER OBJECT - CREATE ENTRY IN DB
    //REMOVE PASS AND REFERESH TOKEN FIELD FROM RESPONSE
    //CHECK FOR USER CREATION
    //RETURN RESPONSE ELSE ERROR

    //FIRST STEP
    const { fullname,email,username,password } = req.body
    console.log("email : ",email);

    if(
        [fullname,email,username,password].some((field) => 
            field?.trim() === "")
    ){
        throw new Apierror(400,"All fields are required")
    }

    const existedUser = await User.findOne({
        $or :  [{username},{email}]
    })

    if(existedUser){
        throw new Apierror(409,"User with email already exists")
    }

    const avatarlocalpath = req.files?.avatar?.[0]?.path;
    const coverimagelocalpath = req.files?.coverimage?.[0]?.path;

    if(!avatarlocalpath){
        throw new Apierror(400,"Avatar file is required")
    }

    const avatar = await uploadOnCloudinary(avatarlocalpath)
    const coverimage = await uploadOnCloudinary(coverimagelocalpath)

    if(!avatar){
        throw new Apierror(400,"Avatar file is required")
    }

    const user = await User.create({
        fullname,
        avatar : avatar.url,
        coverimage : coverimage?.url || "",
        email,
        password,
        username : username.toLowerCase()
    })

    const createduser = await User.findById(user._id).select(
        "-passwaord -refreshToken"
    )

    if(!createduser){
        throw new Apierror(500,"Something went wrong")
    }

    return res.status(201).json(
        new Apiresponse(200,createduser,"User registered succsessfully")
    )
})

const loginUser = asynchandler(async (req,res) => {
    //REQ BODY -> DTA
    //USERNAME OR EMAIL
    //FIND THE USER
    //PASSWORD CHECK
    //ACCESS AND REFERESH TOKEN
    //SEND COOKIES

    const {email,username,password} = req.body

    if(!username){
        throw new Apierror(400,"usernmae is required")
    }

    const user = User.findOne({
        $or : [{username},{email}]
    })

    if(!user){
        throw new Apierror(404,"User does not exist")
    }

    const ispasswordvalid = await user.isPasswordCorrect(password)

    if(!ispasswordvalid){
        throw new Apierror(404,"password is not valid")
    }

    const {accessToken, refreshToken} = await generateAccessAndRefereshTokens(user._id)

    const loggedInUser = await User.findById(user._id).select("-password -refreshToken")

    const options = {
        httpOnly: true,
        secure: true
    }

    return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
        new Apiresponse(
            200, 
            {
                user: loggedInUser, accessToken, refreshToken
            },
            "User logged In Successfully"
        )
    )
})

const logoutUser = asynchandler(async(req, res) => {
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $unset: {
                refreshToken: 1 
            }
        },
        {
            new: true
        }
    )

    const options = {
        httpOnly: true,
        secure: true
    }

    return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new Apiresponse(200, {}, "User logged Out"))
})

const refreshAccessToken = asynchandler(async (req, res) => {
    const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken

    if (!incomingRefreshToken) {
        throw new Apierror(401, "unauthorized request")
    }

    try {
        const decodedToken = jwt.verify(
            incomingRefreshToken,
            process.env.REFRESH_TOKEN_SECRET
        )
    
        const user = await User.findById(decodedToken?._id)
    
        if (!user) {
            throw new Apierror(401, "Invalid refresh token")
        }
    
        if (incomingRefreshToken !== user?.refreshToken) {
            throw new Apierror(401, "Refresh token is expired or used")
            
        }
    
        const options = {
            httpOnly: true,
            secure: true
        }
    
        const {accessToken, newRefreshToken} = await generateAccessAndRefereshTokens(user._id)
    
        return res
        .status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", newRefreshToken, options)
        .json(
            new Apiresponse(
                200, 
                {accessToken, refreshToken: newRefreshToken},
                "Access token refreshed"
            )
        )
    } catch (error) {
        throw new Apierror(401, error?.message || "Invalid refresh token")
    }

})

const changeCurrentPassword = asyncHandler(async(req, res) => {
    const {oldPassword, newPassword} = req.body

    const user = await User.findById(req.user?._id)
    const isPasswordCorrect = await user.isPasswordCorrect(oldPassword)

    if (!isPasswordCorrect) {
        throw new ApiError(400, "Invalid old password")
    }

    user.password = newPassword
    await user.save({validateBeforeSave: false})

    return res
    .status(200)
    .json(new ApiResponse(200, {}, "Password changed successfully"))
})

const getCurrentUser = asyncHandler(async(req, res) => {
    return res
    .status(200)
    .json(new ApiResponse(
        200,
        req.user,
        "User fetched successfully"
    ))
})

const updateAccountDetails = asyncHandler(async(req, res) => {
    const {fullName, email} = req.body

    if (!fullName || !email) {
        throw new ApiError(400, "All fields are required")
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                fullName,
                email: email
            }
        },
        {new: true}
        
    ).select("-password")

    return res
    .status(200)
    .json(new ApiResponse(200, user, "Account details updated successfully"))
});

const updateUserAvatar = asyncHandler(async(req, res) => {
    const avatarLocalPath = req.file?.path

    if (!avatarLocalPath) {
        throw new ApiError(400, "Avatar file is missing")
    }

    //TODO: delete old image - assignment

    const avatar = await uploadOnCloudinary(avatarLocalPath)

    if (!avatar.url) {
        throw new ApiError(400, "Error while uploading on avatar")
        
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set:{
                avatar: avatar.url
            }
        },
        {new: true}
    ).select("-password")

    return res
    .status(200)
    .json(
        new ApiResponse(200, user, "Avatar image updated successfully")
    )
})

const updateUserCoverImage = asyncHandler(async(req, res) => {
    const coverImageLocalPath = req.file?.path

    if (!coverImageLocalPath) {
        throw new ApiError(400, "Cover image file is missing")
    }

    //TODO: delete old image - assignment


    const coverImage = await uploadOnCloudinary(coverImageLocalPath)

    if (!coverImage.url) {
        throw new ApiError(400, "Error while uploading on avatar")
        
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set:{
                coverImage: coverImage.url
            }
        },
        {new: true}
    ).select("-password")

    return res
    .status(200)
    .json(
        new ApiResponse(200, user, "Cover image updated successfully")
    )
})


export { registerUser,loginUser,logoutUser,refreshAccessToken,changeCurrentPassword,getCurrentUser, }