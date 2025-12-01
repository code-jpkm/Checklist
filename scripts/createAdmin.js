// backend/src/scripts/createAdmin.js
import { connectDb } from '../config/db.js';
import { User } from '../models/User.js';

const run = async () => {
  try {
    await connectDb();

    // CHANGE THESE VALUES TO YOUR ADMIN DETAILS
    const name = 'Sayantan Mondal';
    const email = 'sde1@jpkm.in';
    const password = 'Diyasayantan'; // change to something strong
    const department = 'Admin';
    const whatsappNumber = '917047437018'; // e.g. "91XXXXXXXXXX"

    let user = await User.findOne({ email });

    if (!user) {
      const passwordHash = await User.hashPassword(password);
      user = await User.create({
        name,
        email,
        passwordHash,
        department,
        whatsappNumber,
        role: 'ADMIN'
      });
      console.log('Admin user created:');
    } else {
      // if user exists, upgrade to admin and optionally reset password
      user.role = 'ADMIN';
      user.passwordHash = await User.hashPassword(password);
      await user.save();
      console.log('Existing user updated to ADMIN:');
    }

    console.log({
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role
    });

    process.exit(0);
  } catch (err) {
    console.error('Error creating admin:', err);
    process.exit(1);
  }
};

run();
