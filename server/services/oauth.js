const { getService } = require('../utils/getService');
const strapiUtils = require('@strapi/utils');
const generator = require('generate-password');

module.exports = ({ strapi }) => ({
  async createUser(email, lastname, firstname, roles = []) {
    const createdUser = await getService('user').create({
      firstname: firstname ? firstname : 'unset',
      lastname: lastname ? lastname : '',
      email,
      roles,
      preferedLanguage: 'en',
    });

    return await getService('user').register({
      registrationToken: createdUser.registrationToken,
      userInfo: {
        firstname: firstname ? firstname : 'unset',
        lastname: lastname ? lastname : 'user',
        password: generator.generate({
          length: 12,
          numbers: true,
          lowercase: true,
          uppercase: true,
          exclude: '()+_-=}{[]|:;"/?.><,`~',
          strict: true,
        }),
      },
    });
  },
  async triggerWebHook(user) {
    const { ENTRY_CREATE } = strapiUtils.webhook.webhookEvents;
    const modelDef = strapi.getModel('admin::user');
    const sanitizedEntity = await strapiUtils.sanitize.sanitizers.defaultSanitizeOutput(modelDef, user);
    strapi.eventHub.emit(ENTRY_CREATE, {
      model: modelDef.modelName,
      entry: sanitizedEntity,
    });
  },
  triggerSignInSuccess(user) {
    delete user['password'];
    strapi.eventHub.emit('admin.auth.success', {
      user,
      provider: 'strapi-plugin-sso',
    });
  },
  // Sign In Success
  renderSignUpSuccess(jwtToken, user, nonce) {
    return `
<!doctype html>
<html>
<head>
<noscript>
<h3>JavaScript must be enabled for authentication</h3>
</noscript>
<script nonce="${nonce}">
 window.addEventListener('load', function() {
   sessionStorage.setItem('jwtToken', '"${jwtToken}"');
   sessionStorage.setItem('userInfo', '${JSON.stringify(user)}');
   location.href = '/admin'
 })
</script>
</head>
<body>
</body>
</html>`;
  },
  // Sign In Error
  renderSignUpError(message) {
    return `
<!doctype html>
<html>
<head></head>
<body>
<h3>Authentication failed</h3>
<p>${message}</p>
</body>
</html>`;
  },
});
