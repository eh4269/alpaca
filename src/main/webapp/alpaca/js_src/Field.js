(function($) {

    var Alpaca = $.alpaca;
    
    /**
     * Abstract Field class
     *
     * Defines a field which contains a value and core functions.
     * These functions are left empty and are intended to be implemented in inheriting classes.
     *
     * Provides support for templated rendering.
     *
     * This takes in an options block which look like this:
     *
     * {
     *    id: <id>,                     				field id (optional)
     *    type: <type>,                 				field type (optional) - "text" if not specified
     *    schema: schema,              					field schema (optional)
     *    settings: settings            				field settings (optional) - {} if not specified
     * }
     *
     * The settings block consists of the following:
     *
     * SETTINGS
     * {
     *    fieldClass: [<string>]                        optional - additional css classes to apply
     *    validate: <boolean>			        		optional - whether to validate on change (true)
     *    disabled: <boolean>                           optional - whether to initialize as disabled (false)
     *    displayMessages: <boolean>                    optional - whether to display message (true)
     * }
     *
     * JSON SCHEMA:
     *
     * This class obeys JSON schema for:
     *
     * {
     *    optional: <boolean>							[optional] (false)
     *    default: <any>                                [optional]
     * }
     */
    Alpaca.Field = Base.extend({
    
        /**
         * Constructor
         *
         * @param container The DOM element to which this field is bound.
         * @param data The data bound to this field.
         * @param options (optional)
         *
         * Options consists of:
         *
         * {
         *    id: <id>,                     field id (optional)
         *    type: <type>,                 field type (optional)
         *    settings: settings            field settings (optional)
         * }
         *
         * @param schema field schema (optional)
         */
        constructor: function(container, data, options, schema,view) {
            // mark that we are initializing
            this.initializing = true;
            
            // container
            this.container = container;
            
            // parent
            this.parent = null;
            this.data = data;
            this.options = options;
            this.schema = schema;
			
			// check if this field rendering is single-level or not
			this.singleLevelRendering = false;
			 			
			if (view) {
				this.setView(view);
			} else {
				this.setView(Alpaca.defaultView);
			}
            
            // things we can draw off the options
            if (!this.options) {
                this.options = {};
            }
            this.id = this.options.id;
            this.type = this.options.type;
            this.settings = this.options.settings;
            if (this.options.template) {
                this.setTemplate(this.options.template);
            }
            
            // setup defaults
            if (!this.id) {
                this.id = Alpaca.generateId();
            }
            if (!this.schema) {
                this.schema = {};
            }
            if (!this.settings) {
                this.settings = {};
            }
            if (!this.settings.label && this.schema.title) {
                this.settings.label = this.schema.title;
            }
            if (!this.settings.helper && this.schema.description) {
                this.settings.helper = this.schema.description;
            }
            
            // data
            if (!this.data && this.schema["default"]) {
                this.data = this.schema["default"];
            }
            
            // backup data
            this.backupData = Alpaca.cloneObject(this.data);
        },
		
		/**
		 * Sets up default rendition template from view
		 */
		setDefaultTemplate: function () {
            // check if the full template has been provided
			var fullTemplate = Alpaca.getTemplate("full", this);
            if (fullTemplate) {
				this.setTemplate(fullTemplate);
				this.singleLevelRendering = true;
			} else {
				this.setTemplate(Alpaca.getTemplate("field", this));
			}			
		},
        
        /**
         * Sets up any default values for this field.
         */
        setup: function() {
 
            if (!this.initializing) {
				this.data = this.getValue();
            }
            
            // if we have already created backup settings, restore from them
			/*
            if (this.backupSettings) {
                this.settings = Alpaca.cloneObject(this.backupSettings);
            } else {
                this.backupSettings = Alpaca.cloneObject(this.settings);
            }
            */
                        
			this.setDefaultTemplate();
            
            // JSON SCHEMA
            if (Alpaca.isUndefined(this.schema.optional)) {
                this.schema.optional = false;
            }
            
            // SETTINGS             
            if (Alpaca.isUndefined(this.settings.validate)) {
                this.settings.validate = true;
            }
            
            if (Alpaca.isUndefined(this.settings.disabled)) {
                this.settings.disabled = false;
            }
            
            // MESSAGES                        
            if (Alpaca.isUndefined(this.settings.showMessages)) {
                this.settings.showMessages = true;
            }
        },
                
        /**
         * Binds the data into the field.  Called at the very end of construction.
         */
        bindData: function() {
            if (this.data) {
                this.setValue(this.data, true);
            }
        },
                
        /**
         * Renders this field into the container.
         * Creates an outerEl which is bound into the container.
         */
        render: function(view) {
            if (view) {
				this.setView(view);
			}
            this.setup();			
			this._render();
        },
        
        /**
         * Internal method for processing the render.
         */
        _render: function() {
            var _this = this;
            
            // remove the previous outerEl if it exists
            if (this.getEl()) {
                this.getEl().remove();
            }
            
            // check if it needs to be wrapped in a form
            if (this.options.form) {
                var form = new Alpaca.Form(this.container, this.options.form);
                form.render(function(form) {
                    // load the appropriate template and render it
                    _this._processRender(form.formFieldsContainer, function() {
                    
                        // bind our field dom element into the container
                        $(_this.getEl()).appendTo(form.formFieldsContainer);
                        
                        // bind the top field to the form
                        form.topField = _this;
                        
                        // allow any post-rendering facilities to kick in
                        _this.postRender();
                    });
                });
            } else {
                // load the appropriate template and render it
                this._processRender(this.container, function() {
                
                    // bind our field dom element into the container
                    $(_this.getEl()).appendTo(_this.container);
                    
                    // allow any post-rendering facilities to kick in
                    _this.postRender();
                });
            }
        },
        
        /**
         * Responsible for fetching any templates needed so as to render the
         * current mode for this field.
         *
         * Once completed, the onSuccess method is called.
         */
        _processRender: function(parentEl, onSuccess) {
            var _this = this;
            
            // lookup the template we should use to render
            var template = this.getTemplate();
            
            // if we have a template to load, load it and then render
            if (Alpaca.isUri(template)) {
                // load template from remote location
                $.ajax({
                    url: template,
                    type: 'get',
                    success: function(templateString) {
                        _this._renderLoadedTemplate(parentEl, templateString, onSuccess);
                    },
                    error: function(error) {
                        alert(error);
                    }
                });
            } else {
                // we already have the template, so just render it
                this._renderLoadedTemplate(parentEl, template, onSuccess);
            }
        },
        
        /**
         * Renders the loaded template
         */
        _renderLoadedTemplate: function(parentEl, templateString, onSuccess) {
            // render field template
            var renderedDomElement = $.tmpl(templateString, {
                "id": this.getId(),
                "settings": this.settings,
                "data": this.data,
				"view": this.getView()
            }, {});
            renderedDomElement.appendTo($(parentEl));
            this.setEl(renderedDomElement);
            
            if (!this.singleLevelRendering) {
				this.renderField(onSuccess);
			}
        },

        /**
         * Called after the rendering is complete as a way to make final modifications to the
         * dom elements that were produced.
         */
        postRender: function() {
			// for edit or create mode
			// injects Ids
			if (this.getEl().attr("id") == null) {
				this.getEl().attr("id", this.getId() + "-field-outer");
			}
			if (this.getEl().attr("alpaca-field-id") == null) {
				this.getEl().attr("alpaca-field-id", this.getId());
			}
			// Support for custom CSS class for the field
			var fieldClass = this.settings["fieldClass"];
			if (fieldClass) {
				$(this.getEl()).addClass(fieldClass);
			}			
			// optional
			if (this.settings.optional) {
				$(this.getEl()).addClass("alpaca-field-optional");
			} else {
				$(this.getEl()).addClass("alpaca-field-required");
			}
			
			// after render
			if (this.settings.disabled) {
				this.disable();
			}			
			// bind data
			if (this.getViewType() && this.getViewType() == 'edit') {
				this.bindData();
			}
			// initialize events (after part of the dom)
			if (this.getViewType() && this.getViewType() != 'view') {
				this.initEvents();
			}
			
			// finished initializing
			this.initializing = false;

			// final call to update validation state
 			if (this.getViewType() != 'view') {
				this.renderValidationState();
			}

		},
        
        /**
         * Retrieves the rendering element
         */
        getEl: function() {
            return $(this.outerEl);
        },
        
        /**
         * Sets the rendering element
         */
        setEl: function(outerEl) {
            this.outerEl = outerEl;
        },
        
        /**
         * Returns the id of the field
         */
        getId: function() {
            return this.id;
        },
        
        getType: function() {
            return this.type;
        },
        
        /**
         * Returns this field's parent field.
         */
        getParent: function() {
            return this.parent;
        },
        
        /**
         * Returns the value of the field
         */
        getValue: function() {
            return this.data;
        },
        
        /**
         * Sets the value of the field
         */
        setValue: function(value, stopUpdateTrigger) {
            this.data = value;
            
            // set corresponding style
            this.renderValidationState();
            
            if (!stopUpdateTrigger) {
                this.triggerUpdate();
            }
        },
        
        /**
         * Returns the field template
         */
        getTemplate: function() {
            return this.template;
        },
        
        /**
         * Sets the field template
         */
        setTemplate: function(template) {
            // if template is a function, evaluate it to get a string
            if (Alpaca.isFunction(template)) {
                template = template();
            }
            // trim for good measure
            template = $.trim(template);
            
            this.template = template;
        },

        /**
         * Gets current view
         */
        getView: function() {
			return this.view;
        },
        
        /**
         * Sets view
         */
        setView: function(view) {
            if (Alpaca.isString(view) && !Alpaca.isEmpty(Alpaca.views[view])) {
				// view id
				this.view = view;
			} else {
				// actual view object
				this.view = view;
			}
			this.viewType = Alpaca.getViewType(this.view);
        },
		
		/**
         * Gets current view type
         */
        getViewType: function() {
			return this.viewType;
        },
		        
        /**
         * Renders a validation state message below the field.
         */
        displayMessage: function(message) {
            // remove the message element if it exists
            if (this.messageElement) {
                $(this.messageElement).remove();
            }
            // add message and generate it
            if (message && message.length > 0) {
                var messageTemplate = Alpaca.getTemplate("controlFieldMessage", this);
                if (messageTemplate) {
                    this.messageElement = $.tmpl(messageTemplate, {
                        "message": message
                    });
                    this.messageElement.addClass("alpaca-field-message");
                    // check to see if we have a message container rendered
                    if ($('.alpaca-field-message-container', this.getEl()).length) {
                        this.messageElement.appendTo($('.alpaca-field-message-container', this.getEl()));
                    } else {
                        this.messageElement.appendTo(this.getEl());
                    }
                }
            }
        },
        
        /**
         * Makes sure that the DOM of the rendered field reflects the validation state
         * of the field.
         */
        renderValidationState: function() {
            // remove all previous markers
            $(this.getEl()).removeClass("alpaca-field-invalid");
            $(this.getEl()).removeClass("alpaca-field-valid");
            $(this.getEl()).removeClass("alpaca-field-empty");
            
            // this runs validation
            var state = this.getValidationState();
            
            if (state == Alpaca.STATE_INVALID) {
                $(this.getEl()).addClass("alpaca-field-invalid");
            }
            if (state == Alpaca.STATE_VALID) {
                $(this.getEl()).addClass("alpaca-field-valid");
            }
            if (state == Alpaca.STATE_EMPTY_OK) {
                $(this.getEl()).addClass("alpaca-field-empty");
            }
            
            // Allow for the message to change
            if (this.settings.showMessages) {
                if (!this.initializing) {
                    this.displayMessage(this.getValidationStateMessage(state));
                }
            }
        },
        
        /**
         * Returns the validation state code for the field
         */
        getValidationState: function() {
            var state = null;
            
            var validated = this.validate();
            if (validated) {
                state = Alpaca.STATE_VALID;
            } else {
                state = Alpaca.STATE_INVALID;
            }
            
            return state;
        },
        
        /**
         * Converts the validation state into a message.
         */
        getValidationStateMessage: function(state) {

            if (state == Alpaca.STATE_INVALID) {
				if (!this._validateOptional()) {
					return Alpaca.getMessage("notOptional", this);
				}
				if (!this._validateDisallow()) {
					return Alpaca.getMessage("disallowValue", this);
				}
			}
			
            var message = Alpaca.getMessage(state, this);
            if (!message) {
                message = "";
            }
            
            return message;
        },
        
        /**
         * Validates this field and returns whether it is in a valid state.
         */
        validate: function() {
            // skip out if we haven't yet bound any data into this control
            // the control can still be considered to be initializing
            if (this.initializing) {
                return true;
            }
            
            var isValid = true;
            
            if (this.settings.validate) {
                isValid = this.handleValidate();
            }
            
            return isValid;
        },
        
        /**
         * To be overridden for additional validations
         *
         * Performs validation
         */
        handleValidate: function() {
            if (!this._validateOptional()) {
                return false;
            }
            if (!this._validateDisallow()) {
                return false;
            }            
            return true;
        },
        
        /**
         * Checks whether validation is optional
         */
        _validateOptional: function() {
			var val = this.getValue();
			
			if ( this.isEmpty() && !this.schema.optional) {
				return false;
			}
			return true;
		},
        
        /**
         * Checks whether validation is optional
         */
        _validateDisallow: function() {
            var val = this.getValue();
            
			if (!Alpaca.isEmpty(this.schema.disallow)) {
				var disallow = this.schema.disallow;				
				if (Alpaca.isArray(disallow)) {
					var isAllowed = true;
					$.each(disallow, function (index,value) {
						if ( Alpaca.compareObject(val,value) ) {
							isAllowed = false;
						}						
					});
					return isAllowed;
				} else {
					return !Alpaca.compareObject(val,disallow);
				}
			}
            
            return true;
        },
        
        /**
         * Triggers any event handlers that want to listen to an update event for this field
         */
        triggerUpdate: function() {
            $(this.getEl()).trigger("fieldupdate");
        },
        
        /**
         * Disable the field
         */
        disable: function() {
            // OVERRIDE
        },
        
        /**
         * Enable the field
         */
        enable: function() {
            // OVERRIDE
        },
        
        /**
         * Focus the field
         */
        focus: function() {
            // OVERRIDE
        },
        
        /**
         * Purge any event listeners
         * Remove the field from the DOM
         */
        destroy: function() {
            $(this.getEl()).remove();
        },
        
        /**
         * Show the field
         */
        show: function() {
            $(this.getEl()).css({
                "display": ""
            });
        },
        
        /**
         * Hide the field
         */
        hide: function() {
            $(this.getEl()).css({
                "display": "none"
            });
        },

        /**
         * Hide the field
         */
        print: function() {
			if (this.container.printArea) {
				this.container.printArea();
			}
		},
		
		/**
		 * Reload the field
		 */
		reload: function() {
			this.initializing = true;
			this.render();
		},
		        
        /**
         * Clear the field.
         *
         * This resets the field to its original value (this.data)
         */
        clear: function(stopUpdateTrigger) {
            var newValue = null;
            
            if (this.data) {
                newValue = this.data;
            }
            
            if (newValue == null) {
                newValue = null;
            }
            
            this.setValue(newValue, stopUpdateTrigger);
        },
        
        /**
         * True if the field is empty
         */
        isEmpty: function() {
            var empty = false;
            
            var val = this.getValue();
            
            if (!val || val == "") {
                empty = true;
            }
            
            return empty;
        },
        
        /**
         * Initialize events
         */
        initEvents: function() {
            var _this = this;
            // trigger control level handlers for things that happen to input element
            $(this.inputElement).change(function(e) {
                _this.onChange(e);
            });
            
            $(this.inputElement).focus(function(e) {
                _this.onFocus(e);
            });
            
            $(this.inputElement).blur(function(e) {
                _this.onBlur(e);
            });
        },
        
        /**
         * Highlights the entire field
         */
        onFocus: function(e) {
            $(this.getEl()).removeClass("alpaca-field-empty");
            $(this.getEl()).addClass("alpaca-field-focused");
        },
        
        /**
         * Unhighlights the entire field
         */
        onBlur: function(e) {
            $(this.getEl()).removeClass("alpaca-field-focused");
            
            // set class from state
            this.renderValidationState();
        },
        
        /**
         * Field value changed
         */
        onChange: function(e) {
            // store back into data element
            this.data = this.getValue();
            this.triggerUpdate();
        }
        
    });

    // Registers additonal messages
	Alpaca.registerMessages({
        "disallowValue": "This value is disallowed.",
        "notOptional": "This field is not optional."		
    });
	    
    /**
     * Information about the arguments for this field
     * This isn't used at runtime
     * It's used with the form builder.
     */
    Alpaca.Field.groupSettings = [{
        name: "id",
        label: "ID",
        type: "string",
        description: "The ID to use for this field.  If not specified, an ID will automatically be generated.",
        optional: true,
        defaultValue: "An automatically generated ID"
    }, {
        name: "type",
        label: "Type",
        type: "string",
        description: "The ID of the field type to instantiate (i.e. 'text')",
        optional: true,
        defaultValue: "textfield"
    }, {
        name: "template",
        label: "Template",
        type: "string",
        description: "URL or text of the template to use to render this field",
        optional: true,
        defaultValue: "Stock template"
    }, {
        name: "validate",
        label: "Process Validation?",
        type: "boolean",
        description: "Whether to process validation for this field",
        optional: true,
        defaultValue: true
    }, {
        name: "fielClass",
        label: "Field CSS Class",
        type: "string",
        description: "Custom CSS class name to apply to the field element",
        optional: true,
        defaultValue: null
    }, {
        name: "disabled",
        label: "Disabled",
        type: "boolean",
        description: "Whether the field is disabled upon rendering",
        optional: true,
        defaultValue: false
    }];
    
})(jQuery);
