(function () {
  'use strict';

  var form = document.getElementById('teranga-form');
  if (!form) return;

  var msgEl = document.getElementById('teranga-message');
  var submitBtn = document.getElementById('teranga-submit');

  // Set min date to today
  var today = new Date().toISOString().split('T')[0];
  var checkinInput = document.getElementById('tb-checkin');
  var checkoutInput = document.getElementById('tb-checkout');
  if (checkinInput) checkinInput.min = today;
  if (checkoutInput) checkoutInput.min = today;

  checkinInput && checkinInput.addEventListener('change', function () {
    var nextDay = new Date(this.value);
    nextDay.setDate(nextDay.getDate() + 1);
    checkoutInput.min = nextDay.toISOString().split('T')[0];
    if (checkoutInput.value && checkoutInput.value <= this.value) {
      checkoutInput.value = nextDay.toISOString().split('T')[0];
    }
  });

  function showMessage(text, isError) {
    msgEl.textContent = text;
    msgEl.className = 'teranga-message ' + (isError ? 'teranga-error' : 'teranga-success');
    msgEl.style.display = 'block';
  }

  function setLoading(loading) {
    submitBtn.disabled = loading;
    submitBtn.textContent = loading ? 'Traitement en cours...' : 'Payer et réserver avec FedaPay';
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    msgEl.style.display = 'none';

    var guest = document.getElementById('tb-guest').value.trim();
    var room = document.getElementById('tb-room').value.trim();
    var start = checkinInput.value;
    var end = checkoutInput.value;
    var email = document.getElementById('tb-email').value.trim();
    var phone = document.getElementById('tb-phone').value.trim();
    var numberOfGuests = parseInt(document.getElementById('tb-guests').value) || 1;

    if (!guest || !room || !start || !end) {
      showMessage('Veuillez remplir tous les champs obligatoires.', true);
      return;
    }

    if (end <= start) {
      showMessage('La date de départ doit être après la date d\'arrivée.', true);
      return;
    }

    setLoading(true);

    // Open FedaPay checkout
    if (typeof FedaPay === 'undefined') {
      showMessage('Erreur de chargement du module de paiement. Rechargez la page.', true);
      setLoading(false);
      return;
    }

    FedaPay.init({
      public_key: TerangaBooking.fedapayKey,
      environment: TerangaBooking.fedapayEnv,
      transaction: {
        amount: 0, // Will be set dynamically or use a fixed booking fee
        description: 'Réservation chambre ' + room + ' — ' + guest,
        custom_metadata: {
          guest: guest,
          room: room,
          start: start,
          end: end,
          email: email,
          phone: phone
        }
      },
      customer: {
        email: email || undefined,
        phone_number: phone ? { number: phone, country: 'BJ' } : undefined,
        firstname: guest.split(' ')[0],
        lastname: guest.split(' ').slice(1).join(' ') || guest
      },
      onComplete: function (resp) {
        if (resp.reason === FedaPay.CHECKOUT_COMPLETED) {
          // Payment successful — create booking in Teranga PMS
          var txnId = resp.transaction && resp.transaction.id ? String(resp.transaction.id) : '';
          var txnAmount = resp.transaction && resp.transaction.amount ? resp.transaction.amount : 0;

          var formData = new FormData();
          formData.append('action', 'teranga_create_booking');
          formData.append('nonce', TerangaBooking.nonce);
          formData.append('guest', guest);
          formData.append('room', room);
          formData.append('start', start);
          formData.append('end', end);
          formData.append('guestEmail', email);
          formData.append('guestPhone', phone);
          formData.append('numberOfGuests', String(numberOfGuests));
          formData.append('fedapayTransactionId', txnId);
          formData.append('externalRef', 'fedapay_' + txnId);
          if (txnAmount > 0) {
            formData.append('amountPaid', String(txnAmount));
          }

          fetch(TerangaBooking.ajaxUrl, {
            method: 'POST',
            body: formData
          })
            .then(function (r) { return r.json(); })
            .then(function (result) {
              setLoading(false);
              if (result.success) {
                showMessage('Réservation confirmée ! Vous recevrez un email de confirmation.', false);
                form.reset();
                if (TerangaBooking.successPage) {
                  setTimeout(function () {
                    window.location.href = TerangaBooking.successPage;
                  }, 2000);
                }
              } else {
                showMessage(result.data && result.data.message ? result.data.message : 'Erreur lors de la réservation.', true);
              }
            })
            .catch(function () {
              setLoading(false);
              showMessage('Erreur de connexion. Votre paiement a été effectué, contactez-nous.', true);
            });
        } else {
          setLoading(false);
          showMessage('Paiement annulé ou échoué.', true);
        }
      },
      onCancel: function () {
        setLoading(false);
      }
    }).open();
  });
})();
