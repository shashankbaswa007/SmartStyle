const major = Number(process.versions.node.split('.')[0] || 0);

const MIN = 18;
const MAX_EXCLUSIVE = 23;

if (major < MIN || major >= MAX_EXCLUSIVE) {
  console.error(
    `[SmartStyle] Unsupported Node.js version ${process.version}. ` +
      `Please use Node ${MIN}-22 (recommended: 20 LTS).`
  );
  process.exit(1);
}
