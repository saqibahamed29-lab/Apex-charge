/* Apex Charge Labs — theme behavior
   Mobile nav, sticky header, scroll-reveal, variant selection, real Shopify
   cart AJAX (cart/add.js, cart/change.js, cart.js), sticky mobile CTA. */
(function () {
  "use strict";

  var docEl = document.documentElement;
  docEl.classList.remove("no-js");

  var prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var animationsEnabled = document.body.getAttribute("data-animations") !== "false" && !prefersReducedMotion;

  var moneyFormat = window.Shopify && Shopify.money_format ? Shopify.money_format : "${{amount}}";

  function formatMoney(cents) {
    var value = (cents / 100).toFixed(2);
    return moneyFormat.replace(/\{\{\s*amount\s*\}\}/, value).replace(/^(?!\$)/, function (m) {
      return moneyFormat.indexOf("$") === -1 ? "$" + m : m;
    });
  }

  /* ------------------------------------------------------------------ */
  /* Header stuck state                                                  */
  /* ------------------------------------------------------------------ */
  var header = document.querySelector("[data-header]");
  if (header) {
    var updateHeaderState = function () {
      header.classList.toggle("is-stuck", window.scrollY > 4);
    };
    updateHeaderState();
    window.addEventListener("scroll", updateHeaderState, { passive: true });
  }

  /* ------------------------------------------------------------------ */
  /* Mobile nav                                                          */
  /* ------------------------------------------------------------------ */
  var mobileNav = document.querySelector("[data-mobile-nav]");
  var navOpenBtns = document.querySelectorAll("[data-nav-open]");
  var navCloseBtns = document.querySelectorAll("[data-nav-close]");

  function setMobileNav(open) {
    if (!mobileNav) return;
    mobileNav.classList.toggle("is-open", open);
    mobileNav.setAttribute("aria-hidden", open ? "false" : "true");
    document.body.style.overflow = open ? "hidden" : "";
    navOpenBtns.forEach(function (btn) { btn.setAttribute("aria-expanded", open ? "true" : "false"); });
  }

  navOpenBtns.forEach(function (btn) { btn.addEventListener("click", function () { setMobileNav(true); }); });
  navCloseBtns.forEach(function (btn) { btn.addEventListener("click", function () { setMobileNav(false); }); });
  mobileNav && mobileNav.querySelectorAll("a").forEach(function (a) {
    a.addEventListener("click", function () { setMobileNav(false); });
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") setMobileNav(false);
  });

  /* ------------------------------------------------------------------ */
  /* Scroll-reveal                                                       */
  /* ------------------------------------------------------------------ */
  var animatedEls = document.querySelectorAll("[data-animate]");
  if (animatedEls.length) {
    if (!animationsEnabled || !("IntersectionObserver" in window)) {
      animatedEls.forEach(function (el) { el.classList.add("is-visible"); });
    } else {
      var groups = document.querySelectorAll("[data-animate-group]");
      groups.forEach(function (group) {
        Array.prototype.forEach.call(group.children, function (child, i) {
          child.style.setProperty("--i", i);
        });
      });

      var revealObserver = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting) {
              entry.target.classList.add("is-visible");
              revealObserver.unobserve(entry.target);
            }
          });
        },
        { threshold: 0.15, rootMargin: "0px 0px -8% 0px" }
      );
      animatedEls.forEach(function (el) { revealObserver.observe(el); });
    }
  }

  /* ------------------------------------------------------------------ */
  /* Variant selection (product purchase section)                       */
  /* ------------------------------------------------------------------ */
  document.querySelectorAll("[data-product-form]").forEach(function (form) {
    var hiddenInput = form.querySelector("[data-selected-variant-id]");
    var addButton = form.querySelector("[data-add-to-cart]");
    var addLabel = form.querySelector("[data-add-label]");
    var options = form.querySelectorAll("[data-variant-option]");

    function selectOption(option) {
      options.forEach(function (o) { o.classList.remove("is-selected"); });
      option.classList.add("is-selected");
      var input = option.querySelector('input[type="radio"]');
      if (input) input.checked = true;

      var variantId = option.getAttribute("data-variant-id");
      var priceCents = parseInt(option.getAttribute("data-variant-price"), 10);
      if (hiddenInput) hiddenInput.value = variantId;
      if (addLabel && !isNaN(priceCents)) {
        addLabel.textContent = "Add to Cart — " + formatMoney(priceCents);
      }
    }

    options.forEach(function (option) {
      option.addEventListener("click", function (e) {
        if (e.target.tagName === "INPUT") return;
        selectOption(option);
      });
      var input = option.querySelector('input[type="radio"]');
      if (input) {
        input.addEventListener("change", function () { selectOption(option); });
      }
    });

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (addButton && addButton.disabled) return;

      var originalLabel = addLabel ? addLabel.textContent : "";
      if (addButton) addButton.disabled = true;
      if (addLabel) addLabel.textContent = "Adding…";

      var body = new FormData(form);

      fetch("/cart/add.js", {
        method: "POST",
        headers: { Accept: "application/json" },
        body: body,
      })
        .then(function (res) {
          if (!res.ok) return res.json().then(function (err) { throw err; });
          return res.json();
        })
        .then(function () {
          return refreshCart();
        })
        .then(function () {
          openCart();
        })
        .catch(function (err) {
          if (addLabel) addLabel.textContent = (err && err.description) || "Couldn't add to cart";
          window.setTimeout(function () {
            if (addLabel) addLabel.textContent = originalLabel;
          }, 2200);
        })
        .finally(function () {
          if (addButton) addButton.disabled = false;
          if (addLabel && addLabel.textContent === "Adding…") addLabel.textContent = originalLabel;
        });
    });
  });

  /* ------------------------------------------------------------------ */
  /* Cart drawer                                                         */
  /* ------------------------------------------------------------------ */
  var drawer = document.querySelector("[data-cart-drawer]");
  var overlay = document.querySelector("[data-cart-overlay]");
  var cartBody = document.querySelector("[data-cart-body]");
  var cartFoot = document.querySelector("[data-cart-foot]");
  var cartSubtotal = document.querySelector("[data-cart-subtotal]");
  var cartCountEls = document.querySelectorAll("[data-cart-count]");

  function openCart() {
    if (!drawer) return;
    drawer.classList.add("is-open");
    overlay.classList.add("is-open");
    document.body.style.overflow = "hidden";
  }
  function closeCart() {
    if (!drawer) return;
    drawer.classList.remove("is-open");
    overlay.classList.remove("is-open");
    document.body.style.overflow = "";
  }

  document.querySelectorAll("[data-cart-open]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      openCart();
      refreshCart();
    });
  });
  document.querySelectorAll("[data-cart-close]").forEach(function (btn) {
    btn.addEventListener("click", closeCart);
  });
  overlay && overlay.addEventListener("click", closeCart);
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") closeCart();
  });

  function renderCartLine(item) {
    var el = document.createElement("div");
    el.className = "cart-line";
    el.innerHTML =
      '<img src="' + (item.image || "") + '" alt="" width="64" height="64" loading="lazy">' +
      '<div style="flex:1;">' +
        '<p class="cart-line__title">' + item.product_title + "</p>" +
        (item.variant_title ? '<p class="cart-line__variant">' + item.variant_title + "</p>" : "") +
        '<div class="cart-line__qty">' +
          '<button type="button" data-qty-decrease aria-label="Decrease quantity">−</button>' +
          '<span>' + item.quantity + "</span>" +
          '<button type="button" data-qty-increase aria-label="Increase quantity">+</button>' +
        "</div>" +
        '<button type="button" class="cart-line__remove" data-qty-remove>Remove</button>' +
      "</div>" +
      '<span class="cart-line__price">' + formatMoney(item.final_line_price) + "</span>";

    var decreaseBtn = el.querySelector("[data-qty-decrease]");
    var increaseBtn = el.querySelector("[data-qty-increase]");
    var removeBtn = el.querySelector("[data-qty-remove]");

    decreaseBtn.addEventListener("click", function () {
      changeLine(item.key, Math.max(0, item.quantity - 1));
    });
    increaseBtn.addEventListener("click", function () {
      changeLine(item.key, item.quantity + 1);
    });
    removeBtn.addEventListener("click", function () {
      changeLine(item.key, 0);
    });

    return el;
  }

  function changeLine(key, quantity) {
    fetch("/cart/change.js", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ id: key, quantity: quantity }),
    })
      .then(function (res) { return res.json(); })
      .then(function (cart) { renderCart(cart); })
      .catch(function () {});
  }

  function renderCart(cart) {
    cartCountEls.forEach(function (el) {
      el.textContent = cart.item_count;
      el.classList.toggle("is-visible", cart.item_count > 0);
    });

    if (!cartBody) return;

    if (cart.item_count === 0) {
      cartBody.innerHTML = '<p class="cart-drawer__empty">Your cart is empty.</p>';
      if (cartFoot) cartFoot.hidden = true;
      return;
    }

    cartBody.innerHTML = "";
    cart.items.forEach(function (item) {
      cartBody.appendChild(renderCartLine(item));
    });

    if (cartFoot) {
      cartFoot.hidden = false;
      if (cartSubtotal) cartSubtotal.textContent = formatMoney(cart.total_price);
    }
  }

  function refreshCart() {
    return fetch("/cart.js", { headers: { Accept: "application/json" } })
      .then(function (res) { return res.json(); })
      .then(function (cart) { renderCart(cart); return cart; });
  }

  refreshCart();

  /* ------------------------------------------------------------------ */
  /* Sticky mobile CTA                                                   */
  /* ------------------------------------------------------------------ */
  var stickyCta = document.querySelector("[data-sticky-cta]");
  var purchaseSection = document.getElementById("purchase-apex");

  if (stickyCta && purchaseSection && "IntersectionObserver" in window) {
    var hasEnteredView = false;
    var stickyName = stickyCta.querySelector("[data-sticky-name]");
    var stickyPrice = stickyCta.querySelector("[data-sticky-price]");
    var stickyAction = stickyCta.querySelector("[data-sticky-action]");

    var titleEl = purchaseSection.querySelector(".h-section");
    if (titleEl && stickyName) stickyName.textContent = titleEl.textContent.trim();

    function syncStickyPrice() {
      var selected = purchaseSection.querySelector("[data-variant-option].is-selected [data-variant-price], .variant-option.is-selected");
      var priceEl = purchaseSection.querySelector(".variant-option.is-selected .variant-option__price-now");
      if (priceEl && stickyPrice) stickyPrice.textContent = priceEl.textContent.trim();
    }
    syncStickyPrice();
    purchaseSection.addEventListener("click", function () { window.setTimeout(syncStickyPrice, 0); });

    var ctaObserver = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) hasEnteredView = true;
          var shouldShow = hasEnteredView && !entry.isIntersecting && window.innerWidth < 900;
          stickyCta.classList.toggle("is-visible", shouldShow);
          stickyCta.setAttribute("aria-hidden", shouldShow ? "false" : "true");
        });
      },
      { threshold: 0 }
    );
    ctaObserver.observe(purchaseSection);

    stickyAction && stickyAction.addEventListener("click", function () {
      purchaseSection.scrollIntoView({ behavior: prefersReducedMotion ? "auto" : "smooth", block: "start" });
    });
  }
})();
