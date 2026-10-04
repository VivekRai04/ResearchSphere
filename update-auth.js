const fs = require('fs');
let auth = fs.readFileSync('artifacts/api-server/src/routes/auth.ts', 'utf8');

const oldLoginStart = auth.indexOf("router.get('/login',");
if (oldLoginStart === -1) throw new Error('Not found');

const replacement = `
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(401).json({ error: 'Missing credentials' });

    const user = await db.query.usersTable.findFirst({
      where: (users, { eq }) => eq(users.email, email)
    });
    if (!user || !user.passwordHash) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    const bcrypt = require('bcryptjs');
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    const sid = await createSession({
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        profileImageUrl: user.profileImageUrl,
      },
      access_token: 'local-token',
    });
    setSessionCookie(res, sid);
    return res.json({ user });
  } catch (err) {
    next(err);
  }
});

router.post('/register', async (req, res, next) => {
  try {
    const { email, password, firstName, lastName } = req.body;
    if (!email || !password || !firstName || !lastName) return res.status(400).json({ error: 'Missing fields' });

    const existing = await db.query.usersTable.findFirst({
      where: (users, { eq }) => eq(users.email, email)
    });
    if (existing) {
      return res.status(400).json({ error: 'Email already in use' });
    }
    const bcrypt = require('bcryptjs');
    const passwordHash = await bcrypt.hash(password, 10);
    const [user] = await db.insert(usersTable).values({
      email, passwordHash, firstName, lastName
    }).returning();
    const sid = await createSession({
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        profileImageUrl: user.profileImageUrl,
      },
      access_token: 'local-token',
    });
    setSessionCookie(res, sid);
    return res.json({ user });
  } catch (err) {
    next(err);
  }
});

router.get('/login-old',`;

const newAuth = auth.substring(0, oldLoginStart) + replacement + auth.substring(oldLoginStart + 20);
fs.writeFileSync('artifacts/api-server/src/routes/auth.ts', newAuth);
