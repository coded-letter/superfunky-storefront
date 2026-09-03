(() => {
  const script = document.currentScript;
  const container = script?.closest("[data-prerendered-chrome]");
  if (!(container instanceof HTMLElement) || container.dataset.staticNavigationReady === "true") return;

  container.dataset.staticNavigationReady = "true";
  const cleanups = [];

  const header = container.querySelector(".storefront-static-header");
  const spacer = container.querySelector("[data-static-header-spacer]");
  if (header instanceof HTMLElement && spacer instanceof HTMLElement) {
    let announcementTimer = 0;
    let heightFrame = 0;
    const updateHeight = () => {
      cancelAnimationFrame(heightFrame);
      heightFrame = requestAnimationFrame(() => {
        const islandOffset = header.classList.contains("storefront-static-header--island")
          && header.classList.contains("is-scrolled")
          ? 10
          : 0;
        const measuredHeight = `${header.getBoundingClientRect().height + islandOffset}px`;
        spacer.style.setProperty("--storefront-static-header-height", measuredHeight);
        header.style.setProperty("--storefront-static-header-height", measuredHeight);
      });
    };
    const updateAnnouncement = () => {
      const hasScrolled = scrollY > 4;
      const shouldCollapse = header.dataset.staticAnnouncementScroll !== "false" && hasScrolled;
      header.classList.toggle("is-announcement-collapsed", shouldCollapse);
      header.classList.toggle("is-scrolled", hasScrolled);
      clearTimeout(announcementTimer);
      updateHeight();
      announcementTimer = window.setTimeout(updateHeight, 320);
    };
    const observer = "ResizeObserver" in window ? new ResizeObserver(updateHeight) : null;
    observer?.observe(header);
    updateAnnouncement();
    updateHeight();
    addEventListener("scroll", updateAnnouncement, { passive: true });
    addEventListener("resize", updateHeight, { passive: true });
    cleanups.push(() => {
      observer?.disconnect();
      cancelAnimationFrame(heightFrame);
      clearTimeout(announcementTimer);
      removeEventListener("scroll", updateAnnouncement);
      removeEventListener("resize", updateHeight);
    });
  }

  const mobileToggle = container.querySelector("[data-static-mobile-toggle]");
  const mobileBackdrop = container.querySelector("[data-static-mobile-backdrop]");
  const mobileDrawer = container.querySelector(".storefront-static-mobile-drawer");
  if (
    mobileToggle instanceof HTMLButtonElement
    && mobileBackdrop instanceof HTMLElement
    && mobileDrawer instanceof HTMLElement
  ) {
    const closeButton = mobileDrawer.querySelector("[data-static-mobile-close]");
    const focusableSelector = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';
    let closeTimer = 0;
    let restoreFocus = null;
    let lockedScrollY = 0;
    let bodyStyle = null;

    const unlockBody = () => {
      if (!bodyStyle) return;
      Object.assign(document.body.style, bodyStyle);
      bodyStyle = null;
      scrollTo({ top: lockedScrollY, behavior: "auto" });
    };
    const finishClose = (restore = true) => {
      clearTimeout(closeTimer);
      mobileBackdrop.hidden = true;
      unlockBody();
      if (restore && restoreFocus instanceof HTMLElement) restoreFocus.focus({ preventScroll: true });
    };
    const open = () => {
      clearTimeout(closeTimer);
      if (mobileToggle.getAttribute("aria-expanded") === "true") return;
      restoreFocus = document.activeElement instanceof HTMLElement ? document.activeElement : mobileToggle;
      lockedScrollY = scrollY;
      const style = document.body.style;
      bodyStyle = {
        position: style.position,
        top: style.top,
        left: style.left,
        right: style.right,
        width: style.width,
      };
      style.position = "fixed";
      style.top = `-${lockedScrollY}px`;
      style.left = "0";
      style.right = "0";
      style.width = "100%";
      mobileBackdrop.hidden = false;
      mobileBackdrop.getBoundingClientRect();
      mobileBackdrop.classList.add("is-open");
      mobileToggle.setAttribute("aria-expanded", "true");
      requestAnimationFrame(() => (closeButton || mobileDrawer).focus({ preventScroll: true }));
    };
    const close = (restore = true) => {
      if (mobileBackdrop.hidden) return;
      mobileBackdrop.classList.remove("is-open");
      mobileToggle.setAttribute("aria-expanded", "false");
      closeTimer = window.setTimeout(() => finishClose(restore), 220);
    };
    const handleToggle = (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (mobileBackdrop.hidden) open();
      else close();
    };
    const handleBackdropClick = (event) => {
      const target = event.target instanceof Element ? event.target : null;
      const expand = target?.closest("[data-static-mobile-expand]");
      if (expand instanceof HTMLButtonElement && mobileDrawer.contains(expand)) {
        const children = document.getElementById(expand.getAttribute("aria-controls") || "");
        if (!children) return;
        const expanded = expand.getAttribute("aria-expanded") === "true";
        expand.setAttribute("aria-expanded", String(!expanded));
        children.hidden = expanded;
        return;
      }
      if (target?.closest("[data-static-mobile-close]") || target === mobileBackdrop) close();
    };
    const handleKeydown = (event) => {
      if (mobileBackdrop.hidden) return;
      if (event.key === "Escape") {
        event.preventDefault();
        close();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = [...mobileDrawer.querySelectorAll(focusableSelector)]
        .filter((element) => !element.closest("[hidden]"));
      if (!focusable.length) {
        event.preventDefault();
        mobileDrawer.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    mobileToggle.addEventListener("click", handleToggle);
    mobileBackdrop.addEventListener("click", handleBackdropClick);
    document.addEventListener("keydown", handleKeydown);
    cleanups.push(() => {
      mobileToggle.removeEventListener("click", handleToggle);
      mobileBackdrop.removeEventListener("click", handleBackdropClick);
      document.removeEventListener("keydown", handleKeydown);
      mobileBackdrop.classList.remove("is-open");
      mobileToggle.setAttribute("aria-expanded", "false");
      finishClose(false);
    });
  }

  let closeTimer = 0;
  const closeAll = (except) => {
    container.querySelectorAll(".storefront-static-nav-item.is-open").forEach((item) => {
      if (item === except) return;
      item.classList.remove("is-open");
      delete item.dataset.openedByClick;
      const submenu = item.querySelector(".storefront-static-submenu");
      submenu?.style.removeProperty("--storefront-static-submenu-left");
      submenu?.style.removeProperty("--storefront-static-submenu-max-width");
      submenu?.style.removeProperty("--storefront-static-submenu-max-height");
      item.querySelector("[data-static-submenu-toggle]")?.setAttribute("aria-expanded", "false");
      submenu?.setAttribute("aria-hidden", "true");
    });
  };
  const openItem = (item) => {
    clearTimeout(closeTimer);
    closeAll(item);
    item.classList.add("is-open");
    const submenu = item.querySelector(".storefront-static-submenu");
    if (submenu instanceof HTMLElement) {
      const viewportPadding = 16;
      const itemRect = item.getBoundingClientRect();
      const submenuRect = submenu.getBoundingClientRect();
      const maxWidth = Math.max(0, innerWidth - viewportPadding * 2);
      const width = Math.min(submenuRect.width, maxWidth);
      const left = Math.max(viewportPadding, Math.min(itemRect.left, innerWidth - width - viewportPadding));
      submenu.style.setProperty("--storefront-static-submenu-left", `${left - itemRect.left}px`);
      submenu.style.setProperty("--storefront-static-submenu-max-width", `${maxWidth}px`);
      submenu.style.setProperty(
        "--storefront-static-submenu-max-height",
        `${Math.max(0, innerHeight - itemRect.bottom - 8 - viewportPadding)}px`,
      );
      submenu.setAttribute("aria-hidden", "false");
    }
    item.querySelector("[data-static-submenu-toggle]")?.setAttribute("aria-expanded", "true");
  };
  const handleNavigationClick = (event) => {
    const toggle = event.target instanceof Element
      ? event.target.closest("[data-static-submenu-toggle]")
      : null;
    if (!(toggle instanceof HTMLElement) || !container.contains(toggle)) return;
    event.preventDefault();
    event.stopPropagation();
    const item = toggle.closest(".storefront-static-nav-item");
    if (!(item instanceof HTMLElement)) return;
    if (item.classList.contains("is-open") && item.dataset.openedByClick === "true") {
      closeAll();
      return;
    }
    openItem(item);
    item.dataset.openedByClick = "true";
  };
  const handlePointerOver = (event) => {
    const item = event.target instanceof Element
      ? event.target.closest(".storefront-static-nav-item")
      : null;
    if (!(item instanceof HTMLElement) || !item.querySelector(".storefront-static-submenu")) return;
    if (!item.classList.contains("is-open")) delete item.dataset.openedByClick;
    openItem(item);
  };
  const handlePointerOut = (event) => {
    const item = event.target instanceof Element
      ? event.target.closest(".storefront-static-nav-item.is-open")
      : null;
    if (!(item instanceof HTMLElement) || (event.relatedTarget instanceof Node && item.contains(event.relatedTarget))) return;
    clearTimeout(closeTimer);
    closeTimer = window.setTimeout(() => closeAll(), 150);
  };
  const handleFocusIn = (event) => {
    const item = event.target instanceof Element
      ? event.target.closest(".storefront-static-nav-item")
      : null;
    if (item instanceof HTMLElement && item.querySelector(".storefront-static-submenu")) openItem(item);
  };
  const handleOutsidePointer = (event) => {
    if (event.target instanceof Element && event.target.closest(".storefront-static-nav-item")) return;
    closeAll();
  };
  const handleNavigationKeydown = (event) => {
    const target = event.target instanceof HTMLElement ? event.target : null;
    const toggle = target?.closest("[data-static-submenu-toggle]");
    const openItemElement = target?.closest(".storefront-static-nav-item.is-open");
    if (event.key === "Escape") {
      const activeToggle = openItemElement?.querySelector("[data-static-submenu-toggle]");
      closeAll();
      activeToggle?.focus({ preventScroll: true });
      return;
    }
    if (toggle && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
      const item = toggle.closest(".storefront-static-nav-item");
      if (!(item instanceof HTMLElement)) return;
      event.preventDefault();
      openItem(item);
      const menuItems = [...item.querySelectorAll('.storefront-static-submenu [role="menuitem"]')];
      (event.key === "ArrowDown" ? menuItems[0] : menuItems[menuItems.length - 1])?.focus();
      return;
    }
    if (!(openItemElement instanceof HTMLElement) || !target?.matches('[role="menuitem"]')) return;
    const menuItems = [...openItemElement.querySelectorAll('.storefront-static-submenu [role="menuitem"]')];
    const currentIndex = menuItems.indexOf(target);
    const nextIndex = event.key === "ArrowDown"
      ? Math.min(menuItems.length - 1, currentIndex + 1)
      : event.key === "ArrowUp"
        ? Math.max(0, currentIndex - 1)
        : event.key === "Home"
          ? 0
          : event.key === "End"
            ? menuItems.length - 1
            : -1;
    if (nextIndex < 0) return;
    event.preventDefault();
    menuItems[nextIndex]?.focus();
  };
  const updateOpenSubmenu = () => {
    const item = container.querySelector(".storefront-static-nav-item.is-open");
    if (item instanceof HTMLElement) openItem(item);
  };

  container.addEventListener("click", handleNavigationClick);
  container.addEventListener("pointerover", handlePointerOver);
  container.addEventListener("pointerout", handlePointerOut);
  container.addEventListener("focusin", handleFocusIn);
  document.addEventListener("pointerdown", handleOutsidePointer);
  document.addEventListener("keydown", handleNavigationKeydown);
  window.addEventListener("resize", updateOpenSubmenu, { passive: true });
  cleanups.push(() => {
    clearTimeout(closeTimer);
    closeAll();
    container.removeEventListener("click", handleNavigationClick);
    container.removeEventListener("pointerover", handlePointerOver);
    container.removeEventListener("pointerout", handlePointerOut);
    container.removeEventListener("focusin", handleFocusIn);
    document.removeEventListener("pointerdown", handleOutsidePointer);
    document.removeEventListener("keydown", handleNavigationKeydown);
    window.removeEventListener("resize", updateOpenSubmenu);
  });

  window.__funkyStorefrontStaticNavigation = {
    container,
    cleanup() {
      cleanups.splice(0).reverse().forEach((cleanup) => cleanup());
      delete container.dataset.staticNavigationReady;
      if (window.__funkyStorefrontStaticNavigation?.container === container) {
        delete window.__funkyStorefrontStaticNavigation;
      }
    },
  };
})();
