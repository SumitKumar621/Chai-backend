import { asynchandler } from "../utils/async-handler.js";


const registerUser = asynchandler( async (req,res) => {
    return res.status(200).json({
        message : "Chai aur code"
    })
})

export { registerUser }