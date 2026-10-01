import mongoose from "mongoose"
import dns from "dns";

dns.setServers(["8.8.8.8", "1.1.1.1"]);

import { DB_NAME } from "../constants.js";

const connectDB = async () => {
    try {
        const connectioninst = await mongoose.connect(`${process.env.MONGODB_URI}${DB_NAME}`)
        console.log(`\n MongoDB connected ${connectioninst.host}`);
    }
    catch(error) {
        console.log("Connection ERROR : ", error);
        process.exit(1)
    }
}

export default connectDB