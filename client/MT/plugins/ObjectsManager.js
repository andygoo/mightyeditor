MT.require("ui.TreeView");
MT.require("ui.List");
MT.require("core.Selector");

MT.extend("core.BasicPlugin").extend("core.Emitter")(
	MT.plugins.ObjectsManager = function(project){
		MT.core.Emitter.call(this);
		MT.core.BasicPlugin.call(this, "ObjectsManager");
		this.project = project;
		
		this.selector = new MT.core.Selector();
		
		this.id = Date.now();
		
	},
	{
		initUI: function(ui){
			this.ui = ui;
			this.panel = ui.addPanel("Objects");
			
			var that = this;
			
			this.list = new MT.ui.List([
				{
					label: "new group",
					className: "",
					cb: function(){
						that.newFolder();
					}
				},
				{
					label: "group selected",
					className: "",
					cb: function(){
						that.groupSelected();
					}
				},
				{
					label: "delete selected",
					className: "",
					cb: function(){
						that.deleteSelected();
					}
				}
			], ui, true);
			
			this.list.addClass("settings-list");
			
			this.options = new MT.ui.Button(null, "ui-options", ui.events, function(){
				if(!that.list.isVisible){
					that.list.show(that.panel.header.el);
					that.options.addClass("selected");
				}
				else{
					that.list.hide();
				}
			});
			
			this.list.on("hide", function(){
				that.options.removeClass("selected");
			});
			
			this.panel.header.addChild(this.options);
			this.options.style.width = "33px";
			this.options.style.left = "auto";
			
			this.tv = new MT.ui.TreeView([], {
				root: this.project.path,
				showHide: true
			});
			this.tv.onChange = function(oldItem, newItem){
				console.log("change", oldItem, newItem);
				that.update();
				that.sync();
			};
			
			this.tv.sortable(this.ui.events);
			this.tv.tree.show(this.panel.content.el);
			
			
			this.tv.on("show", function(item){
				if(item.data.isVisible){
					item.data.isVisible = 0;
				}
				else{
					item.data.isVisible = 1;
				}
				that.update();
			});
			
		},
		
		
		installUI: function(ui){
			var that = this;
			
			var tools = this.project.plugins.tools;
			
			tools.on("selectedObject", function(id){
				var el = that.tv.getById(id);
				if(el){
					el.addClass("selected.active");
					that.selector.add(el);
				}
			});
			
			tools.on("unselectedObject", function(id){
				var el = that.tv.getById(id);
				if(el){
					el.removeClass("selected.active");
					that.selector.remove(el);
				}
			});

			this.ui.events.on("mouseup", function(e){
				if(e.target == map.game.canvas){
					that.sync();
				}
			});
			
			this.tv.on("deleted", function(o){
				that.selector.remove(o);
			});
			
		},
		
		a_receive: function(data, silent){
			this.tv.merge(data);
			
			if(!silent){
				this.emit("afterSync", this.tv.getData());
			}
			this.update();
		},
		
		initSocket: function(socket){
			MT.core.BasicPlugin.initSocket.call(this, socket);
		},
		
		//add object from asset
		addObject: function( e, obj ){
			if(obj.contents){
				return;
			}
			
			
			var no = this.createObject(obj, e.offsetX, e.offsetY);
			this.insertObject(no);
		},
		
		insertObject: function(obj){
			var data = this.tv.getData();
			obj.id = "tmp"+this.mkid();
			
			obj.tmpName = obj.tmpName || obj.name;
			
			obj.name = obj.tmpName + this.getNewNameId(obj.tmpName, data, 0);
			data.push(obj);
			
			this.tv.rootPath = this.project.path
			this.tv.merge(data);
			
			this.update();
			this.sync();
			
		},
		
		createObject: function(asset, x, y){
			x = x || 0;
			y = y || 0;
			
			
			var data = this.tv.getData();
			var name = asset.name.split(".");
			name.pop();
			name = name.join("");
			
			console.log("----------->",asset);
			
			return  {
				assetId: asset.id,
				__image: asset.__image,
				x: x,
				y: y,
				anchorX: asset.anchorX,
				anchorY: asset.anchorY,
				scaleX: 1,
				scaleY: 1,
				angle: 0,
				alpha: 1,
				tmpName: name,
				frame: 0,
				isVisible: 1
			};
		},
		
		copy: function(obj, x, y, name){
			name = name || obj.name + this.getNewNameId(obj.name, this.tv.getData());
			var clone = JSON.parse(JSON.stringify(obj));
			clone.name = name;
			clone.x = x;
			clone.y = y;
			
			
			this.cleanUpClone(clone);
			
			
			this.insertObject(clone);
			return clone;
		},
		
		cleanUpClone: function(obj, inc){
			inc = inc || 0;
			inc++;
			
			if(obj.contents){
				for(var i=0; i<obj.contents.length; i++){
					this.cleanUpClone(obj.contents[i], inc);
				}
			}
			obj.id = "tmp"+this.mkid();
		},
		
		
		deleteSelected: function(){
		
			this.selector.forEach(function(obj){
				this.deleteObj(obj.data.id, true);
			}, this);
			
			this.selector.clear();
			
			this.ui.events.simulateKey(MT.keys.esc);
			this.sync();
		},
		
		deleteObj: function(id, silent){
			console.log("delete", id);
			var data = this.tv.getData();
			this._delete(id, data);
			this.tv.merge(data);
			
			
			
			//if using silent.. you should call manually sync
			if(!silent){
				this.ui.events.simulateKey(MT.keys.esc);
				this.sync();
			}
		},
		
		_delete: function(id, data){
			for(var i=0; i<data.length; i++){
				if(data[i].id == id){
					data.splice(i, 1)[0];
					break;
				}
				if(data[i].contents){
					this._delete(id, data[i].contents);
				}
			}
		},
		
		getNewNameId: function(name, data, id){
			id = id || 0;
			var tmpName = name;
			if(id > 0){
				tmpName += id;
			}
			
			
			for(var i=0; i<data.length; i++){
				if(data[i].name == tmpName){
					id++;
					id = this.getNewNameId(name, data, id);
				}
			}
			
			return (id > 0 ? id : "");
		},
		
		buildObjectsTree: function(list){
			var that = this;
			this.tv.rootPath = this.project.path;
			this.tv.merge(list);
			
			this.tv.tree.show(this.panel.content.el);
		},
		
		moveFile: function(a, b){
			this.send("moveFile", {
				a: a,
				b: b
			});
		},
		
		update: function(){
			this.emit("update", this.tv.getData());
		},
		
		newFolder: function(silent){
			var data = this.tv.getData();
			
			var tmpName= "Group";
			var name = tmpName;
			for(var i=0; i<data.length; i++){
				if(data[i].name == name){
					name = tmpName+" "+i;
				}
			}
			
			var group = {
				id: "tmp"+this.mkid(),
				name: name,
				x: 0,
				y: 0,
				angle: 0,
				contents: [],
				isVisible: 1
			};
			
			data.unshift(group);
			
			this.tv.merge(data);
			
			if(!silent){
				this.sync();
			}
			return group;
		},
		
		select: function(id){
			this.tv.select(id);
			
		},
		
		cleanSelection: function(){
			
		},
		
		mkid: function(){
			this.id++;
			
			return this.id;
		},
		
		groupSelected: function(){
			var folder = this.newFolder(true);
			var that = this;
			
			var data = this.tv.getData();
			
			this.selector.forEach(function(el){
				var o = el.data;
				this._delete(o.id, data);
				
				folder.contents.push(o);
				
			}, this);
			
			//this.send("updateData", data);
			
			this.tv.merge(data);
			
			
			this.send("updateData", data);
		},
		
		_syncTm: 0,
		sync: function(silent){
			if(this._syncTm){
				window.clearTimeout(this._syncTm);
				this._syncTm = 0;
			}
			var that = this;
			
			
			this._syncTm = window.setTimeout(function(){
				var data = that.tv.getData();
				var json = JSON.stringify(data);
				if(this._lastData == json){
					this._syncTm = 0;
					return;
				}
				
				console.log("sync");
				this._lastData = json;
				if(!silent){
					that.emit("beforeSync", data);
				}
				
				that.send("updateData", data);
				that._syncTm = 0;
			}, 100);
		},
		
		getById: function(id){
			var items = this.tv.items;
			for(var i=0; i<items.length; i++){
				if(items[i].data.id == id){
					return items[i].data;
				}
			}
			
			return null;
		}
	}
);
