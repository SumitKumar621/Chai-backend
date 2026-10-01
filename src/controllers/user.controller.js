import { asynchandler } from "../utils/async-handler.js";
import { Apierror } from "../utils/Apierror.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { Apiresponse } from "../utils/Apiresponse.js";


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

export { registerUser }