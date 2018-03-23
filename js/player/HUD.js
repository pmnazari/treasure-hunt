var HUD = function(controller)
{
	this.controller = controller;
	this.lastMessageTime = 0;
}

HUD.prototype = {

	/**
	 * Load the 2D HUD
	 * @param window The window in which to draw the map.
	 * @param containerElement The HTML element in which to include the HUD.
	 * @param callback A callback to trigger when the HUD is loaded.
	 */
	Load: function(window, containerElement, callback) {
		let scope = this;

		// load hud.html
		$.get("./hud.html", function(data) {
			$(containerElement).html(data);

			// Setup stuff
			$("#broadcast-button").click(function() {
				scope.ShowChatMessages("broadcast");
			});

			$(function(){
		    // $('.messages').slimScroll();
			});

			$(function(){
		    // $('.full-size-window-content').slimScroll();
			});

			function sendChatMessage()
			{
				let chatID = $(".messages:visible").attr("chatID");
				let text = $("#message-input-box").val();

				if(text!=""){
					let currTime = Date.now();
					if(currTime-scope.lastMessageTime >= 1000){
						scope.controller.SendChatMessage(chatID, text);
						$("#message-input-box").val("");
						scope.lastMessageTime = currTime;
					}
				}
			}

			$("#message-input-button").click(function() // sending chat messages:
			{
				sendChatMessage();
			});

			$("#message-input-box").on('keyup', function(e){
				if(e.keyCode == 13){
					sendChatMessage();
				}
			});

			$("#status-circle").click(function() // ready up
			{
				if (scope.statusButtonState == "enabled")
				{
					scope.controller.EndTurn();
				}
			});

			// Buy/Sell Window:
			$("#buy-food .buy-sell-minus").click(function()	{ scope.controller.UpdateBuySellQuantity("food", -1);	});
			$("#buy-water .buy-sell-minus").click(function() { scope.controller.UpdateBuySellQuantity("water", -1); });
			$("#buy-gas .buy-sell-minus").click(function() { scope.controller.UpdateBuySellQuantity("gas", -1); });
			$("#sell-treasure .buy-sell-minus").click(function() { scope.controller.UpdateBuySellQuantity("treasure", -1); });

			$("#buy-food .buy-sell-plus").click(function() { scope.controller.UpdateBuySellQuantity("food", 1); });
			$("#buy-water .buy-sell-plus").click(function() { scope.controller.UpdateBuySellQuantity("water", 1); });
			$("#buy-gas .buy-sell-plus").click(function() { scope.controller.UpdateBuySellQuantity("gas", 1); });
			$("#sell-treasure .buy-sell-plus").click(function() { scope.controller.UpdateBuySellQuantity("treasure", 1); });

			$(".buy-submit-button").click(function()
			{
				scope.controller.SubmitBuySell();
				closeBuySell();
			});

			// Sea Captain Window:
			$("#sea-captain-weather-button").click(function() {
				scope.controller.ConsultSeaCaptain("weather");
			});
			$("#sea-captain-pirates-button").click(function() {
				scope.controller.ConsultSeaCaptain("pirates");
			});

			// Done: callback
			callback();
		}, "text");
	},

	/**
	 * Set the player's name, as displayed in the bottom bar.
	 * @param name
	 */
	SetPlayerName: function(name)
	{
		$("#team-text").text(name);
	},

	/**
	 * Set the day number, as displayed in the bottom bar.
	 * @param dayNumber
	 */
	SetDayNumber: function(dayNumber)
	{
		$("#day-number-text").text(dayNumber);

		let percent = Math.max((dayNumber / 14) * 100, 0);
		$("#loading-bar").css("width", percent + "%")
	},

	/**
	 * Set the weather, as displayed in the bottom bar.
	 * @param weather A string identifying the weather conditions, either "sunny" or "rain".
	 */
	SetWeather: function(weather)
	{
		$("#weather-text").text(weather == "sunny" ? "Sunny" : "Raining");

		$(".weather-image").hide();
		$(weather == "sunny" ? "#sunny-image" : "#rain-image").show();
	},

	/**
	 * Set the current location, as displayed in the bottom bar.
	 * @param location The name of the location
	 * @param quarters How many quarters of the way to the location we are. Optional.
	 * @param lastLocation The name of the location from which we are 'quarters' quarters to 'location'. Optional.
	 * @param bgColor A color in CSS notation.
	 * @param fgColor A color in CSS notation.
	 */
	SetLocation: function(location, quarters, lastLocation, bgColor, fgColor)
	{
		let suffix = "";
		if (quarters && lastLocation)
			suffix = " (" + (quarters == 2 ? 1 : quarters) + "/" + (quarters == 2 ? 2 : 4) + ")";

		$("#location-text").text(location + suffix);

		$("#location").css("background-color", ((!bgColor || (quarters && lastLocation)) ? "" : bgColor));
		$("#location-text").css("color", ((!fgColor || (quarters && lastLocation)) ? "" : fgColor));
	},

	/**
	 * Set amount of cash, as displayed in the sidebar.
	 * @param cash
	 */
	SetCash: function(cash)
	{
		$("#cash-text").text(cash);
	},

	/**
	 * Set amount of food, as displayed in the sidebar.
	 * @param food
	 * @param noWarning If true, do not warn of 0 food.
	 */
	SetFood: function(food, noWarning)
	{
		$("#food-text").text(food);

		$("#food-alert").toggle(!noWarning && food == 0);
	},

	/**
	 * Set amount of water, as displayed in the sidebar.
	 * @param water
	 * @param noWarning If true, do not warn of 0 water.
	 */
	SetWater: function(water, noWarning)
	{
		$("#water-text").text(water);

		$("#water-alert").toggle(!noWarning && water == 0);
	},

	/**
	 * Set amount of gas, as displayed in the sidebar.
	 * @param gas
	 */
	SetGas: function(gas, noWarning)
	{
		$("#gas-text").text(gas);

		$("#gas-alert").toggle(!noWarning && gas == 0);
	},

	/**
	 * Set amount of treasure, as displayed in the sidebar.
	 * @param treasure
	 */
	SetTreasure: function(treasure)
	{
		$("#treasure-text").text(treasure);
	},

	/**
	 * Set amount of storage in use and in total, as displayed in the sidebar.
	 * @param usedStorage
	 * @param totalStorage
	 */
	SetStorage: function(usedStorage, totalStorage)
	{
		$("#capacity-text").text(usedStorage + "/" + totalStorage);
	},

	/**
	 * Set price of food, as displayed in the buy/sell window.
	 * @param price An integer value, or false if buying food should be disabled.
	 */
	SetFoodPrice: function(price)
	{
		if (price !== false) // enabled
		{
			$("#buy-food .cost p").text(price == 0 ? "FREE" : ("$" + price + " per unit"));
			$("#buy-food").removeClass("buy-sell-disabled");
		}
		else // disabled
		{
			$("#buy-food .cost p").text("unavailable");
			$("#buy-food").addClass("buy-sell-disabled");
		}
	},

	/**
	 * Set price of water, as displayed in the buy/sell window.
	 * @param price An integer value, or false if buying water should be disabled.
	 */
	SetWaterPrice: function(price)
	{
		if (price !== false) // enabled
		{
			$("#buy-water .cost p").text(price == 0 ? "FREE" : ("$" + price + " per unit"));
			$("#buy-water").removeClass("buy-sell-disabled");
		}
		else // disabled
		{
			$("#buy-water .cost p").text("unavailable");
			$("#buy-water").addClass("buy-sell-disabled");
		}
	},

	/**
	 * Set price of gas, as displayed in the buy/sell window.
	 * @param price An integer value, or false if buying gas should be disabled.
	 */
	SetGasPrice: function(price)
	{
		if (price !== false) // enabled
		{
			$("#buy-gas .cost p").text(price == 0 ? "FREE" : ("$" + price + " per unit"));
			$("#buy-gas").removeClass("buy-sell-disabled");
		}
		else // disabled
		{
			$("#buy-gas .cost p").text("unavailable");
			$("#buy-gas").addClass("buy-sell-disabled");
		}
	},

	/**
	 * Set value of treasure, as displayed in the buy/sell window.
	 * @param value An integer value, or false if selling treasure should be disabled.
	 */
	SetTreasureValue: function(value)
	{
		if (value !== false) // enabled
		{
			$("#sell-treasure .cost p").text("$" + value + " per unit");
			$("#sell-treasure").removeClass("buy-sell-disabled");
		}
		else // disabled
		{
			$("#sell-treasure .cost p").text("unavailable");
			$("#sell-treasure").addClass("buy-sell-disabled");
		}
	},

	/**
	 * Enable or disable the buy/sell window (and associated button).
	 * @param enabled A boolean indicating whether to enable the buy/sell window.
	 */
	SetBuySellEnabled: function(enabled)
	{
		window.buySellEnabled = enabled;
		$("#buy-sell").toggleClass("right-button-disabled", !enabled);

		if (!enabled)
		{
			window.closeBuySell();
		}
	},

	/**
	 * Enable or disable the trade window (and associated button).
	 * @param enabled A boolean indicating whether to enable the trade window.
	 */
	SetTradeEnabled: function(enabled)
	{
		window.tradeEnabled = enabled;
		$("#trade").toggleClass("right-button-disabled", !enabled);

		if (!enabled)
		{
			window.closeTradeWindow();
		}
	},

	/**
	 * Enable or disable the sea captain window (and associated button).
	 * @param enabled A boolean indicating whether to enable the sea captain window.
	 */
	SetSeaCaptainEnabled: function(enabled)
	{
		window.seaCaptainEnabled = enabled;
		$("#sea-captain").toggleClass("right-button-disabled", !enabled);

		if (!enabled)
		{
			window.closeCaptainWindow();
		}
	},

	/**
	 * Add a player to the chat and trade options.
	 * @param id The player's ID.
	 * @param name The player's display name.
	 */
	AddPlayer: function(id, name)
	{
		let scope = this;

		// Add chat messages div
		$("<div>").addClass("messages").attr("chatID", id)
			.css("display", "none")
			.prependTo("#message-content-container");

		// Add button for player to chat option list (alphabetically sorted)
		let p = $("<p>").text(name);
		let div = $("<button>").addClass("team-select col btn btn-primary btn-block").attr("userID", id).append(p).click(function() {
			scope.ShowChatMessages(id);
		});
		let nextSibling = $("#chat-select button").not("#broadcast-button").filter(function() {
			return $(this).text().trim().localeCompare(name) > 0;
		}).first();
		if (nextSibling.length > 0)
		{ // there is a next sibling
			div.insertBefore(nextSibling);
		}
		else
		{ // there is no next sibling
			div.appendTo("#chat-select");
		}

		// Add button for player to trade option list (alphabetically sorted)
		// <button class="btn btn-info col-sm-4"><p style="font-size:3vh;">Ship A</p></button>
		p = $("<p style='font-size:3vh;'>").text(name);
		div = $("<button>").addClass("team-select trade-team-item btn btn-primary btn-block").attr("userID", id).append(p).click(function() {
			if ($(this).hasClass("team-select-enabled")) {
				// TODO: redirect to specific trade page
			}
		});
		nextSibling = $("#trade-team-select-container div").filter(function() {
			return $(this).text().trim().localeCompare(name) > 0;
		}).first();
		if (nextSibling.length > 0)
		{ // there is a next sibling
			div.insertBefore(nextSibling);
		}
		else
		{ // there is no next sibling
			div.appendTo("#trade-team-select-container");
		}
	},

	/**
	 * Show chat messages for a particular chat group. Called after the user selects a chat group.
	 * @param chatID The user ID of the selected chat partner, or "broadcast".
	 */
	ShowChatMessages: function(chatID)
	{
		if (chatID == "broadcast" || this.controller.colocalPlayers.includes(chatID)) // if broadcast or colocal
		{
			$("#chat-select").hide(); // hide chat selection screen
			$("#chat-back").show(); // show the chat back button

			$(".messages").hide(); // hide all message groups
			$(".messages[chatID=" + chatID + "]").show(); // show the selected message group

			$("#message-content-container").show(); // show the chat messages screen
		}
	},

	/**
	 * Enable or disable the death overlay, etc.
	 * @param dead A boolean indicating whether the player is dead.
	 */
	SetDead: function(dead)
	{
		// TODO: activate some kind of death overlay that deactivates the 3DMap and displays a skull & crossbones.
		if (dead)
		{
			this.SetBuySellEnabled(false);
			this.SetTradeEnabled(false);
			this.SetSeaCaptainEnabled(false);

			this.SetStatusButtonState("dead");
			$("#death-overlay").css('background-image',"url('assets/icons/skull-crossbones-icon.png')");

			this.showGameOverScreen();
		}
	},

	/**
	 * Enable or disable a player as a unicast chat option.
	 * @param id The player's ID.
	 * @param enabled A boolean indicating whether to enable the player.
	 */
	SetPlayerChatEnabled: function(id, enabled)
	{
		$("#chat-select .team-select[userID=" + id + "]").toggleClass("team-select-enabled", enabled);
		if (!enabled && $(".messages[chatID=" + id + "]:visible").length > 0)
		{ // kick out of unicast chat if it is currently open
			backChat();
		}
	},

	/**
	 * Enable or disable a player as a trade partner option.
	 * @param id The player's ID.
	 * @param enabled A boolean indicating whether to enable the player.
	 */
	SetPlayerTradeEnabled: function(id, enabled)
	{
		$("#trade-team-select-container .team-select[userID=" + id + "]").toggleClass("team-select-enabled", enabled);
		if (!enabled)
		{
			// TODO: kick out of trade offer window if it is currently open
		}
	},

	/**
	 * Add a chat message to the relevant chat pane.
	 * @param otherUserID The ID of the other user in this chat conversation, or "broadcast".
	 * @param message An object with members: "outgoing", "senderName", "urgent", "text", "timestamp".
	 */
	AddChatMessage: function(otherUserID, message)
	{
		let p = $("<p style='margin-right:15px'>").text(message.text);
		if (otherUserID == "broadcast" && !message.outgoing) { // incoming broadcast message
			$("<span>").addClass("message-sender-title").text(message.senderName+': ').prependTo(p);
		}
		let divInner = $("<div>").addClass("message").toggleClass("urgent-message", message.urgent).append(p);
		let divOuter = $("<div>").addClass(message.outgoing ? "messages-local" : "messages-remote").append(divInner);

		let messagesObject = $(".messages[chatID=" + otherUserID + "]");
		messagesObject.append(divOuter); // add new message
		messagesObject[0].scrollTop = messagesObject[0].scrollHeight; // auto-scroll to bottom
	},

	/**
	 * Alert the arrival of a new chat message.
	 * @param otherUserID The ID of the other user in this chat conversation, or "broadcast".
	 * @param message An object with members: "outgoing", "senderID", "urgent", "text", "timestamp".
	 */
	AlertChatMessage: function(otherUserID, message)
	{
		// TODO: present an alert balloon
	},

	/**
	 * Set the state of the status button.
	 * @param state Either "enabled", "waiting", or "dead".
	 */
	SetStatusButtonState: function(state)
	{
		this.statusButtonState = state;

		let statusButton = $("#status-circle");
		let statusText = $("#status-text");

		if (state == "enabled")
		{
			statusText.text("End Turn");
			statusButton.css("backgroundColor", "rgba(50, 200, 40, 0.85)"); // green
		}
		else if (state == "waiting")
		{
			statusText.text("Waiting");
			statusButton.css("backgroundColor", "rgba(220, 220, 0, 0.85)"); // yellow
		}
		else if (state == "dead")
		{
			statusText.text("Dead");
			statusButton.css("backgroundColor", "rgba(110, 110, 110, 0.85)"); // grey
		}
	},

	/**
	 * Set the quantities of buy/sell being considered in the buy/sell window.
	 * @param quantities An object with indicies "food", "water", "gas", and "treasure" pointing to integer quantities.
	 */
	SetBuySellQuantities: function(quantities)
	{
		$("#buy-food .how-many-buying p").text(quantities.food);
		$("#buy-water .how-many-buying p").text(quantities.water);
		$("#buy-gas .how-many-buying p").text(quantities.gas);
		$("#sell-treasure .how-many-buying p").text(quantities.treasure);
	},

	/**
	 * Add a day divider to the alerts window.
	 * @param title The string title to use for this day (e.g. "Day 5").
	 * @param alerts An array of string alerts.
	 */
	AddAlertsDay: function(title, alerts)
	{
		let div = $("<div>").addClass("day-alert-box");
		$("<p>").text(title).appendTo(div);
		$("<hr>").addClass("eighty-percent-hr").appendTo(div);
		$("#day-alert-box-container").append(div);

		// Add Alerts
		for (let i in alerts)
		{
			this.AddAlert(alerts[i]);
		}
	},

	/**
	 * Add an alert to the most recent day. Pop-up the alerts window.
	 * @param text The text of the alert.
	 */
	AddAlert: function(text)
	{
		let div = $("<div>").addClass("alert-box");
		$("<p>").text(text).appendTo(div);

		$(".day-alert-box:last").append(div);
		$("#day-alert-box-container")[0].scrollTop = $("#day-alert-box-container")[0].scrollHeight; // auto-scroll to bottom
		window.showAlerts();
		window.sounds.playOnce("notificationBell");
	},

	/**
	 * Set the sea captain's message.
	 * @param message Either a string message, or boolean false to reset to the question view.
	 */
	SetSeaCaptainMessage: function(message)
	{
		if (message === false) // revert to question view
		{
			$("#captains-buttons-container").show();
			$("#captains-message").hide();
		}
		else // display message
		{
			$("#captains-message p").text(message);
			$("#captains-buttons-container").hide();
			$("#captains-message").show();

			window.sounds.playOnce("piratesArrgh");
		}
	},

	/**
	 * A screen for letting the player know they are dead.
	 * @param none
	 */
	 showGameOverScreen: function(){
			window.sounds.stopAllSounds();
			$("#death-overlay").show();
			$("#death-overlay").animate({opacity:1}, 2000);
			setTimeout(()=>{$('#hud-container, #game-container, canvas').remove();},3000);
	 }

}
